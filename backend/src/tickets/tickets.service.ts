import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import {
  SupportTicketPriority as PrismaSupportTicketPriority,
  SupportTicketStatus as PrismaSupportTicketStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../users/user-role.enum";
import { UsersService } from "../users/users.service";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { FindSupportTicketsQueryDto } from "./dto/find-support-tickets-query.dto";
import { UpdateSupportTicketDto } from "./dto/update-support-ticket.dto";
import { SupportTicketPriority } from "./support-ticket-priority.enum";
import { SupportTicketStatus } from "./support-ticket-status.enum";
import { SupportTicketRecord } from "./support-ticket.types";

@Injectable()
export class TicketsService implements OnModuleInit {
  private readonly tickets = new Map<string, SupportTicketRecord>();

  constructor(
    private readonly usersService: UsersService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const persistedTickets =
      await this.prismaService.client.supportTicket.findMany();

    for (const ticket of persistedTickets) {
      this.tickets.set(ticket.id, {
        ...ticket,
        priority: ticket.priority as SupportTicketPriority,
        status: ticket.status as SupportTicketStatus,
      });
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
      subject: dto.subject.trim(),
      message: dto.message.trim(),
      priority: dto.priority,
      status: SupportTicketStatus.Open,
      adminNote: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };

    if (this.prismaService?.enabled) {
      const persisted = await this.prismaService.client.supportTicket.create({
        data: {
          ...ticket,
          priority: ticket.priority as unknown as PrismaSupportTicketPriority,
          status: ticket.status as unknown as PrismaSupportTicketStatus,
        },
      });
      ticket = {
        ...persisted,
        priority: persisted.priority as SupportTicketPriority,
        status: persisted.status as SupportTicketStatus,
      };
    }

    this.tickets.set(ticket.id, ticket);
    return this.toResponse(ticket);
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
        return [
          ticket.subject,
          ticket.message,
          requester?.username,
          requester?.email,
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

  async update(ticketId: string, dto: UpdateSupportTicketDto) {
    const ticket = this.requireTicket(ticketId);
    if (
      dto.status === undefined &&
      dto.priority === undefined &&
      dto.adminNote === undefined
    ) {
      throw new BadRequestException("At least one ticket field is required");
    }

    const status = dto.status ?? ticket.status;
    const updatedAt = new Date();
    const resolvedAt = [
      SupportTicketStatus.Resolved,
      SupportTicketStatus.Closed,
    ].includes(status)
      ? (ticket.resolvedAt ?? updatedAt)
      : null;
    let updated: SupportTicketRecord = {
      ...ticket,
      status,
      priority: dto.priority ?? ticket.priority,
      adminNote:
        dto.adminNote === undefined
          ? ticket.adminNote
          : dto.adminNote.trim() || null,
      updatedAt,
      resolvedAt,
    };

    if (this.prismaService?.enabled) {
      const persisted = await this.prismaService.client.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: updated.status as unknown as PrismaSupportTicketStatus,
          priority: updated.priority as unknown as PrismaSupportTicketPriority,
          adminNote: updated.adminNote,
          resolvedAt: updated.resolvedAt,
        },
      });
      updated = {
        ...persisted,
        priority: persisted.priority as SupportTicketPriority,
        status: persisted.status as SupportTicketStatus,
      };
    }

    this.tickets.set(ticketId, updated);
    return this.toResponse(updated);
  }

  async clearAll() {
    const deletedTickets = this.tickets.size;
    if (this.prismaService?.enabled) {
      await this.prismaService.client.supportTicket.deleteMany();
    }
    this.tickets.clear();
    return { deletedTickets };
  }

  private requireTicket(ticketId: string) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new NotFoundException("Support ticket not found");
    }
    return ticket;
  }

  private toResponse(ticket: SupportTicketRecord) {
    const requester = this.usersService.findByIdSync(ticket.requesterId);
    return {
      ...ticket,
      requester: requester
        ? {
            id: requester.id,
            username: requester.username,
            email: requester.email,
          }
        : null,
    };
  }
}
