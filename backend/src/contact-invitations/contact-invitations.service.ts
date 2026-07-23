import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ContactInvitationStatus as PrismaContactInvitationStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ConversationsService } from "../conversations/conversations.service";
import { RealtimeEventsService } from "../conversations/realtime-events.service";
import { UsersService } from "../users/users.service";
import { ContactInvitationStatus } from "./contact-invitation-status.enum";
import {
  ContactInvitationRecord,
  ContactInvitationView,
} from "./contact-invitation.types";
import { CreateContactInvitationDto } from "./dto/create-contact-invitation.dto";
import { RespondContactInvitationDto } from "./dto/respond-contact-invitation.dto";

@Injectable()
export class ContactInvitationsService implements OnModuleInit {
  private readonly invitations = new Map<string, ContactInvitationRecord>();

  constructor(
    private readonly usersService: UsersService,
    private readonly conversationsService: ConversationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const persisted =
      await this.prismaService.client.contactInvitation.findMany({
        orderBy: { createdAt: "desc" },
      });

    for (const invitation of persisted) {
      this.invitations.set(invitation.id, {
        ...invitation,
        status: invitation.status as ContactInvitationStatus,
      });
    }
  }

  async create(senderId: string, dto: CreateContactInvitationDto) {
    const sender = await this.usersService.findById(senderId);
    const recipientRecord = await this.usersService.findByEmail(dto.email);

    if (!sender) {
      throw new NotFoundException("Sender user not found");
    }
    if (!recipientRecord) {
      throw new NotFoundException("No registered user has that email address");
    }
    if (recipientRecord.id === senderId) {
      throw new BadRequestException("You cannot invite yourself");
    }

    const recipient = await this.usersService.findById(recipientRecord.id);
    if (!recipient || recipient.isBot) {
      throw new BadRequestException("Automation bots cannot receive invitations");
    }
    if (
      this.conversationsService.hasDirectConversation(senderId, recipient.id)
    ) {
      throw new ConflictException("A direct conversation already exists");
    }

    const pending = Array.from(this.invitations.values()).find(
      invitation =>
        invitation.status === ContactInvitationStatus.Pending &&
        ((invitation.senderId === senderId &&
          invitation.recipientId === recipient.id) ||
          (invitation.senderId === recipient.id &&
            invitation.recipientId === senderId)),
    );
    if (pending) {
      throw new ConflictException(
        "A pending invitation already exists between these users",
      );
    }

    const now = new Date();
    const invitation: ContactInvitationRecord = {
      id: crypto.randomUUID(),
      senderId,
      recipientId: recipient.id,
      message: dto.message?.trim() || null,
      status: ContactInvitationStatus.Pending,
      createdAt: now,
      updatedAt: now,
      respondedAt: null,
    };

    if (this.prismaService?.enabled) {
      await this.prismaService.client.contactInvitation.create({
        data: {
          ...invitation,
          status:
            invitation.status as unknown as PrismaContactInvitationStatus,
        },
      });
    }

    this.invitations.set(invitation.id, invitation);
    const view = this.toView(invitation);
    this.realtimeEventsService.emit({
      type: "contact.invitation.created",
      data: view,
    });
    return view;
  }

  findReceived(userId: string) {
    return Array.from(this.invitations.values())
      .filter(
        invitation =>
          invitation.recipientId === userId &&
          invitation.status === ContactInvitationStatus.Pending,
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(invitation => this.toView(invitation));
  }

  async respond(
    invitationId: string,
    userId: string,
    dto: RespondContactInvitationDto,
  ) {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      throw new NotFoundException("Contact invitation not found");
    }
    if (invitation.recipientId !== userId) {
      throw new ForbiddenException("Only the recipient can respond");
    }
    if (invitation.status !== ContactInvitationStatus.Pending) {
      throw new ConflictException("Contact invitation was already answered");
    }

    const conversation =
      dto.status === ContactInvitationStatus.Accepted
        ? await this.conversationsService.createDirectConversation(userId, {
            participantId: invitation.senderId,
          })
        : null;
    const now = new Date();
    invitation.status = dto.status;
    invitation.updatedAt = now;
    invitation.respondedAt = now;

    if (this.prismaService?.enabled) {
      await this.prismaService.client.contactInvitation.update({
        where: { id: invitation.id },
        data: {
          status: invitation.status as unknown as PrismaContactInvitationStatus,
          respondedAt: now,
        },
      });
    }

    const view = this.toView(invitation);
    this.realtimeEventsService.emit({
      type: "contact.invitation.updated",
      data: view,
    });
    return { invitation: view, conversationId: conversation?.id ?? null };
  }

  async clearAll() {
    const deletedInvitations = this.invitations.size;
    if (this.prismaService?.enabled) {
      await this.prismaService.client.contactInvitation.deleteMany();
    }
    this.invitations.clear();
    return { deletedInvitations };
  }

  private toView(invitation: ContactInvitationRecord): ContactInvitationView {
    const sender = this.usersService.findByIdSync(invitation.senderId);
    const recipient = this.usersService.findByIdSync(invitation.recipientId);
    if (!sender || !recipient) {
      throw new NotFoundException("Invitation user not found");
    }
    return { ...invitation, sender, recipient };
  }
}
