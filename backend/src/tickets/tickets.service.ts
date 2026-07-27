import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import {
  SupportTicketActivityAction as PrismaSupportTicketActivityAction,
  SupportTicketPriority as PrismaSupportTicketPriority,
  SupportTicketStatus as PrismaSupportTicketStatus,
} from "@prisma/client";
import { RealtimeEventsService } from "../conversations/realtime-events.service";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../users/user-role.enum";
import { UsersService } from "../users/users.service";
import { AssignSupportTicketDto } from "./dto/assign-support-ticket.dto";
import { ClaimSupportTicketDto } from "./dto/claim-support-ticket.dto";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { FindSupportTicketsQueryDto } from "./dto/find-support-tickets-query.dto";
import { UpdateSupportTicketDto } from "./dto/update-support-ticket.dto";
import { SupportTicketActivityAction } from "./support-ticket-activity-action.enum";
import { SupportTicketAssignmentFilter } from "./support-ticket-assignment-filter.enum";
import { SupportTicketPriority } from "./support-ticket-priority.enum";
import { SupportTicketStatus } from "./support-ticket-status.enum";
import {
  SupportTicketActivityRecord,
  SupportTicketRecord,
} from "./support-ticket.types";

@Injectable()
export class TicketsService implements OnModuleInit {
  private readonly tickets = new Map<string, SupportTicketRecord>();
  private readonly activities = new Map<
    string,
    SupportTicketActivityRecord[]
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly realtimeEventsService: RealtimeEventsService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const [persistedTickets, persistedActivities] = await Promise.all([
      this.prismaService.client.supportTicket.findMany(),
      this.prismaService.client.supportTicketActivity.findMany({
        orderBy: { createdAt: "asc" },
      }),
    ]);

    for (const ticket of persistedTickets) {
      this.tickets.set(ticket.id, {
        ...ticket,
        priority: ticket.priority as SupportTicketPriority,
        status: ticket.status as SupportTicketStatus,
      });
    }

    for (const activity of persistedActivities) {
      const records = this.activities.get(activity.ticketId) ?? [];
      records.push({
        ...activity,
        action: activity.action as SupportTicketActivityAction,
      });
      this.activities.set(activity.ticketId, records);
    }
  }

  async create(requesterId: string, dto: CreateSupportTicketDto) {
    const requester = await this.usersService.findById(requesterId);
    if (!requester) {
      throw new NotFoundException("Requester user not found");
    }

    const now = new Date();
    let ticket: SupportTicketRecord = {
      id: crypto.randomUUID(),
      requesterId,
      assignedAdminId: null,
      subject: dto.subject.trim(),
      message: dto.message.trim(),
      priority: dto.priority,
      status: SupportTicketStatus.Open,
      adminNote: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    const activity = this.createActivity(
      ticket.id,
      requesterId,
      SupportTicketActivityAction.Created,
      null,
      null,
      now,
    );

    if (this.prismaService?.enabled) {
      const persisted = await this.prismaService.client.supportTicket.create({
        data: {
          ...ticket,
          priority: ticket.priority as unknown as PrismaSupportTicketPriority,
          status: ticket.status as unknown as PrismaSupportTicketStatus,
          activities: {
            create: {
              id: activity.id,
              actorId: activity.actorId,
              action:
                activity.action as unknown as PrismaSupportTicketActivityAction,
              fromValue: activity.fromValue,
              toValue: activity.toValue,
              createdAt: activity.createdAt,
            },
          },
        },
      });
      ticket = this.toTicketRecord(persisted);
    }

    this.tickets.set(ticket.id, ticket);
    this.activities.set(ticket.id, [activity]);
    const response = this.toResponse(ticket);
    this.emitRealtimeEvent("ticket.created", ticket);
    return response;
  }

  findAll(
    currentUserId: string,
    currentUserRole: UserRole,
    query: FindSupportTicketsQueryDto,
  ) {
    const normalizedSearch = query.search?.trim().toLowerCase();
    const visibleTickets = Array.from(this.tickets.values())
      .filter((ticket) => {
        if (
          currentUserRole !== UserRole.Admin &&
          ticket.requesterId !== currentUserId
        ) {
          return false;
        }
        if (
          currentUserRole === UserRole.Admin &&
          query.assignment === SupportTicketAssignmentFilter.Mine &&
          ticket.assignedAdminId !== currentUserId
        ) {
          return false;
        }
        if (
          currentUserRole === UserRole.Admin &&
          query.assignment === SupportTicketAssignmentFilter.Unassigned &&
          ticket.assignedAdminId !== null
        ) {
          return false;
        }
        if (query.status && ticket.status !== query.status) {
          return false;
        }
        if (query.priority && ticket.priority !== query.priority) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }

        const requester = this.usersService.findByIdSync(ticket.requesterId);
        const assignee = ticket.assignedAdminId
          ? this.usersService.findByIdSync(ticket.assignedAdminId)
          : undefined;
        return [
          ticket.subject,
          ticket.message,
          requester?.username,
          requester?.email,
          assignee?.username,
          assignee?.email,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      })
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return {
      items: visibleTickets
        .slice(offset, offset + limit)
        .map((ticket) => this.toResponse(ticket)),
      pageInfo: {
        limit,
        offset,
        total: visibleTickets.length,
        hasMore: offset + limit < visibleTickets.length,
      },
    };
  }

  findOne(ticketId: string, currentUserId: string, currentUserRole: UserRole) {
    const ticket = this.requireTicket(ticketId);
    if (
      currentUserRole !== UserRole.Admin &&
      ticket.requesterId !== currentUserId
    ) {
      throw new ForbiddenException("You cannot view this support ticket");
    }

    return this.toResponse(ticket);
  }

  async claim(ticketId: string, adminId: string, dto: ClaimSupportTicketDto) {
    await this.requireAdmin(adminId);
    const ticket = this.requireTicket(ticketId);
    this.assertVersion(ticket, dto.expectedVersion);

    if (ticket.assignedAdminId === adminId) {
      return this.toResponse(ticket);
    }
    if (ticket.assignedAdminId) {
      throw new ConflictException(
        "Ticket is already assigned to another admin",
      );
    }

    return this.changeAssignment(ticket, adminId, adminId);
  }

  async assign(ticketId: string, actorId: string, dto: AssignSupportTicketDto) {
    await this.requireAdmin(actorId);
    if (dto.adminId) {
      await this.requireAdmin(dto.adminId);
    }

    const ticket = this.requireTicket(ticketId);
    this.assertVersion(ticket, dto.expectedVersion);
    if (ticket.assignedAdminId === dto.adminId) {
      throw new BadRequestException("Ticket assignment is already up to date");
    }

    return this.changeAssignment(ticket, dto.adminId, actorId);
  }

  async update(ticketId: string, adminId: string, dto: UpdateSupportTicketDto) {
    const ticket = this.requireTicket(ticketId);
    this.assertVersion(ticket, dto.expectedVersion);
    if (ticket.assignedAdminId !== adminId) {
      throw new ForbiddenException(
        "Claim this ticket before changing its support details",
      );
    }
    if (
      dto.status === undefined &&
      dto.priority === undefined &&
      dto.adminNote === undefined
    ) {
      throw new BadRequestException("At least one ticket field is required");
    }

    const now = new Date();
    const status = dto.status ?? ticket.status;
    const resolvedAt = [
      SupportTicketStatus.Resolved,
      SupportTicketStatus.Closed,
    ].includes(status)
      ? (ticket.resolvedAt ?? now)
      : null;
    const nextNote =
      dto.adminNote === undefined
        ? ticket.adminNote
        : dto.adminNote.trim() || null;
    const changes: SupportTicketActivityRecord[] = [];

    if (status !== ticket.status) {
      changes.push(
        this.createActivity(
          ticket.id,
          adminId,
          SupportTicketActivityAction.StatusChanged,
          ticket.status,
          status,
          now,
        ),
      );
    }
    const priority = dto.priority ?? ticket.priority;
    if (priority !== ticket.priority) {
      changes.push(
        this.createActivity(
          ticket.id,
          adminId,
          SupportTicketActivityAction.PriorityChanged,
          ticket.priority,
          priority,
          now,
        ),
      );
    }
    if (nextNote !== ticket.adminNote) {
      changes.push(
        this.createActivity(
          ticket.id,
          adminId,
          SupportTicketActivityAction.NoteUpdated,
          ticket.adminNote ? "set" : "empty",
          nextNote ? "set" : "empty",
          now,
        ),
      );
    }
    if (!changes.length) {
      throw new BadRequestException("No ticket changes were provided");
    }

    const updated: SupportTicketRecord = {
      ...ticket,
      status,
      priority,
      adminNote: nextNote,
      version: ticket.version + 1,
      updatedAt: now,
      resolvedAt,
    };

    return this.persistUpdate(ticket.version, updated, changes);
  }

  async clearAll() {
    const deletedTickets = this.tickets.size;
    if (this.prismaService?.enabled) {
      await this.prismaService.client.supportTicket.deleteMany();
    }
    this.tickets.clear();
    this.activities.clear();
    return { deletedTickets };
  }

  private async changeAssignment(
    ticket: SupportTicketRecord,
    assignedAdminId: string | null,
    actorId: string,
  ) {
    const now = new Date();
    const action = !ticket.assignedAdminId
      ? SupportTicketActivityAction.Assigned
      : !assignedAdminId
        ? SupportTicketActivityAction.Unassigned
        : SupportTicketActivityAction.Transferred;
    const activity = this.createActivity(
      ticket.id,
      actorId,
      action,
      ticket.assignedAdminId,
      assignedAdminId,
      now,
    );
    const updated: SupportTicketRecord = {
      ...ticket,
      assignedAdminId,
      version: ticket.version + 1,
      updatedAt: now,
    };

    return this.persistUpdate(ticket.version, updated, [activity]);
  }

  private async persistUpdate(
    expectedVersion: number,
    updated: SupportTicketRecord,
    newActivities: SupportTicketActivityRecord[],
  ) {
    let persisted = updated;

    if (this.prismaService?.enabled) {
      const databaseTicket = await this.prismaService.client.$transaction(
        async (transaction) => {
          const result = await transaction.supportTicket.updateMany({
            where: { id: updated.id, version: expectedVersion },
            data: {
              assignedAdminId: updated.assignedAdminId,
              status: updated.status as unknown as PrismaSupportTicketStatus,
              priority:
                updated.priority as unknown as PrismaSupportTicketPriority,
              adminNote: updated.adminNote,
              resolvedAt: updated.resolvedAt,
              version: updated.version,
            },
          });
          if (result.count !== 1) {
            throw new ConflictException(
              "Ticket changed since it was opened; reload and try again",
            );
          }

          await transaction.supportTicketActivity.createMany({
            data: newActivities.map((activity) => ({
              ...activity,
              action:
                activity.action as unknown as PrismaSupportTicketActivityAction,
            })),
          });
          return transaction.supportTicket.findUniqueOrThrow({
            where: { id: updated.id },
          });
        },
      );
      persisted = this.toTicketRecord(databaseTicket);
    }

    this.tickets.set(persisted.id, persisted);
    const activities = this.activities.get(persisted.id) ?? [];
    activities.push(...newActivities);
    this.activities.set(persisted.id, activities);
    const response = this.toResponse(persisted);
    this.emitRealtimeEvent("ticket.updated", persisted);
    return response;
  }

  private emitRealtimeEvent(
    type: "ticket.created" | "ticket.updated",
    ticket: SupportTicketRecord,
  ) {
    this.realtimeEventsService.emit({
      type,
      data: {
        ticketId: ticket.id,
        requesterId: ticket.requesterId,
        version: ticket.version,
      },
    });
  }

  private assertVersion(ticket: SupportTicketRecord, expectedVersion: number) {
    if (ticket.version !== expectedVersion) {
      throw new ConflictException(
        "Ticket changed since it was opened; reload and try again",
      );
    }
  }

  private async requireAdmin(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || user.role !== UserRole.Admin) {
      throw new BadRequestException("Ticket assignee must be an admin");
    }
    return user;
  }

  private requireTicket(ticketId: string) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new NotFoundException("Support ticket not found");
    }
    return ticket;
  }

  private createActivity(
    ticketId: string,
    actorId: string | null,
    action: SupportTicketActivityAction,
    fromValue: string | null,
    toValue: string | null,
    createdAt: Date,
  ): SupportTicketActivityRecord {
    return {
      id: crypto.randomUUID(),
      ticketId,
      actorId,
      action,
      fromValue,
      toValue,
      createdAt,
    };
  }

  private toTicketRecord(ticket: {
    id: string;
    requesterId: string;
    assignedAdminId: string | null;
    subject: string;
    message: string;
    priority: string;
    status: string;
    adminNote: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  }): SupportTicketRecord {
    return {
      ...ticket,
      priority: ticket.priority as SupportTicketPriority,
      status: ticket.status as SupportTicketStatus,
    };
  }

  private toResponse(ticket: SupportTicketRecord) {
    const requester = this.usersService.findByIdSync(ticket.requesterId);
    const assignedAdmin = ticket.assignedAdminId
      ? this.usersService.findByIdSync(ticket.assignedAdminId)
      : undefined;
    const activities = [...(this.activities.get(ticket.id) ?? [])]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .map((activity) => {
        const actor = activity.actorId
          ? this.usersService.findByIdSync(activity.actorId)
          : undefined;
        return {
          ...activity,
          actor: actor
            ? {
                id: actor.id,
                username: actor.username,
                email: actor.email,
              }
            : null,
        };
      });

    return {
      ...ticket,
      requester: requester
        ? {
            id: requester.id,
            username: requester.username,
            email: requester.email,
          }
        : null,
      assignedAdmin: assignedAdmin
        ? {
            id: assignedAdmin.id,
            username: assignedAdmin.username,
            email: assignedAdmin.email,
          }
        : null,
      activities,
    };
  }
}
