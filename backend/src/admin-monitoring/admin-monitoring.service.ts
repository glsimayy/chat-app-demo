import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { AdminMessageAccessReason as PrismaAdminMessageAccessReason } from "@prisma/client";
import { CallsService } from "../calls/calls.service";
import { ConversationType } from "../conversations/conversation-type.enum";
import { ConversationsService } from "../conversations/conversations.service";
import {
  ConversationRecord,
  MessageRecord,
} from "../conversations/conversation.types";
import { PrismaService } from "../database/prisma.service";
import { MetricsService } from "../metrics/metrics.service";
import { SupportTicketStatus } from "../tickets/support-ticket-status.enum";
import { TicketsService } from "../tickets/tickets.service";
import { UserRole } from "../users/user-role.enum";
import { UsersService } from "../users/users.service";
import { AdminMessageAccessReason } from "./admin-message-access-reason.enum";
import { AdminMessageAccessAuditRecord } from "./admin-monitoring.types";
import { FindAdminAuditsQueryDto } from "./dto/find-admin-audits-query.dto";
import { FindAdminMessagesQueryDto } from "./dto/find-admin-messages-query.dto";
import { RevealAdminMessageDto } from "./dto/reveal-admin-message.dto";

@Injectable()
export class AdminMonitoringService implements OnModuleInit {
  private readonly accessAudits = new Map<
    string,
    AdminMessageAccessAuditRecord
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly conversationsService: ConversationsService,
    private readonly callsService: CallsService,
    private readonly ticketsService: TicketsService,
    private readonly metricsService: MetricsService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const persisted =
      await this.prismaService.client.adminMessageAccessAudit.findMany({
        orderBy: { createdAt: "desc" },
      });

    for (const audit of persisted) {
      this.accessAudits.set(audit.id, {
        ...audit,
        reason: audit.reason as AdminMessageAccessReason,
      });
    }
  }

  async getOverview() {
    const users = await this.usersService.findAll();
    const { conversations, messages } =
      this.conversationsService.getAdminMonitoringSnapshot();
    const calls = this.callsService.getAdminMonitoringRecords();
    const tickets = this.ticketsService.getAdminMonitoringRecords();
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const attachments = messages.flatMap(
      (message) => message.attachments ?? [],
    );

    return {
      totals: {
        users: users.length,
        admins: users.filter((user) => user.role === UserRole.Admin).length,
        conversations: conversations.length,
        directConversations: conversations.filter(
          (conversation) => conversation.type === ConversationType.Direct,
        ).length,
        groupConversations: conversations.filter(
          (conversation) => conversation.type === ConversationType.Group,
        ).length,
        managementConversations: conversations.filter(
          (conversation) => conversation.type === ConversationType.Management,
        ).length,
        botManagedGroups: conversations.filter(
          (conversation) =>
            conversation.type === ConversationType.Group &&
            conversation.isBotManaged,
        ).length,
        messages: messages.length,
        deletedMessages: messages.filter((message) => message.deletedAt).length,
        attachments: attachments.length,
        attachmentBytes: attachments.reduce(
          (total, attachment) => total + attachment.fileSize,
          0,
        ),
        calls: calls.length,
        supportTickets: tickets.length,
        openSupportTickets: tickets.filter((ticket) =>
          [SupportTicketStatus.Open, SupportTicketStatus.InProgress].includes(
            ticket.status,
          ),
        ).length,
        messageContentAccesses: this.accessAudits.size,
      },
      activity24h: {
        newUsers: users.filter((user) => user.createdAt.getTime() >= since)
          .length,
        newConversations: conversations.filter(
          (conversation) => conversation.createdAt.getTime() >= since,
        ).length,
        messages: messages.filter(
          (message) => message.createdAt.getTime() >= since,
        ).length,
        attachments: attachments.filter(
          (attachment) => attachment.createdAt.getTime() >= since,
        ).length,
        calls: calls.filter((call) => call.startedAt.getTime() >= since).length,
        supportTickets: tickets.filter(
          (ticket) => ticket.createdAt.getTime() >= since,
        ).length,
        messageContentAccesses: Array.from(this.accessAudits.values()).filter(
          (audit) => audit.createdAt.getTime() >= since,
        ).length,
      },
      runtime: this.metricsService.getSnapshot(),
      collectedAt: new Date(),
    };
  }

  getMessages(query: FindAdminMessagesQueryDto) {
    const { conversations, messages } =
      this.conversationsService.getAdminMonitoringSnapshot();
    const conversationById = new Map(
      conversations.map((conversation) => [conversation.id, conversation]),
    );
    const normalizedSearch = query.search?.trim().toLowerCase();
    const from = query.from ? new Date(query.from).getTime() : undefined;
    const to = query.to ? new Date(query.to).getTime() : undefined;

    const filtered = messages
      .filter((message) => {
        const conversation = conversationById.get(message.conversationId);
        if (!conversation) {
          return false;
        }
        if (query.senderId && message.senderId !== query.senderId) {
          return false;
        }
        if (
          query.conversationId &&
          message.conversationId !== query.conversationId
        ) {
          return false;
        }
        if (
          query.conversationType &&
          conversation.type !== query.conversationType
        ) {
          return false;
        }
        if (from !== undefined && message.createdAt.getTime() < from) {
          return false;
        }
        if (to !== undefined && message.createdAt.getTime() > to) {
          return false;
        }
        if (
          query.hasAttachments !== undefined &&
          Boolean(message.attachments?.length) !== query.hasAttachments
        ) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }

        const sender = message.senderId
          ? this.usersService.findByIdSync(message.senderId)
          : undefined;
        return [sender?.username, sender?.email, conversation.name].some(
          (value) => value?.toLowerCase().includes(normalizedSearch),
        );
      })
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return {
      items: filtered
        .slice(offset, offset + limit)
        .map((message) =>
          this.toMessageMetadata(
            message,
            conversationById.get(message.conversationId)!,
          ),
        ),
      pageInfo: {
        limit,
        offset,
        total: filtered.length,
        hasMore: offset + limit < filtered.length,
      },
    };
  }

  async revealMessage(
    messageId: string,
    adminId: string,
    dto: RevealAdminMessageDto,
  ) {
    const message = this.conversationsService.findMessageForAdmin(messageId);
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (message.deletedAt) {
      throw new GoneException("Deleted message content cannot be revealed");
    }

    const audit: AdminMessageAccessAuditRecord = {
      id: crypto.randomUUID(),
      adminId,
      messageId,
      reason: dto.reason,
      justification: dto.justification.trim(),
      createdAt: new Date(),
    };

    if (this.prismaService?.enabled) {
      await this.prismaService.client.adminMessageAccessAudit.create({
        data: {
          ...audit,
          reason: audit.reason as unknown as PrismaAdminMessageAccessReason,
        },
      });
    }

    this.accessAudits.set(audit.id, audit);

    return {
      auditId: audit.id,
      messageId,
      content: message.content,
      attachments: (message.attachments ?? []).map((attachment) => ({
        ...attachment,
      })),
      revealedAt: audit.createdAt,
    };
  }

  getMessageAttachment(
    messageId: string,
    attachmentId: string,
    auditId: string,
    adminId: string,
  ) {
    const audit = this.accessAudits.get(auditId);
    if (!audit || audit.adminId !== adminId || audit.messageId !== messageId) {
      throw new ForbiddenException(
        "A matching message access audit is required",
      );
    }

    return this.conversationsService.getAttachmentForAdmin(
      messageId,
      attachmentId,
    );
  }

  assertMatchingAudit(auditId: string, adminId: string, messageId: string) {
    const audit = this.accessAudits.get(auditId);
    if (!audit || audit.adminId !== adminId || audit.messageId !== messageId) {
      throw new ForbiddenException(
        "A matching message access audit is required",
      );
    }

    return audit;
  }

  getMessageMetadata(messageId: string) {
    const message = this.conversationsService.findMessageForAdmin(messageId);
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    const conversation = this.conversationsService
      .getAdminMonitoringSnapshot()
      .conversations.find((item) => item.id === message.conversationId);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return this.toMessageMetadata(message, conversation);
  }

  getAccessAudits(query: FindAdminAuditsQueryDto) {
    const { conversations } =
      this.conversationsService.getAdminMonitoringSnapshot();
    const conversationById = new Map(
      conversations.map((conversation) => [conversation.id, conversation]),
    );
    const sorted = Array.from(this.accessAudits.values()).sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return {
      items: sorted.slice(offset, offset + limit).map((audit) => {
        const admin = this.usersService.findByIdSync(audit.adminId);
        const message = this.conversationsService.findMessageForAdmin(
          audit.messageId,
        );
        const conversation = message
          ? conversationById.get(message.conversationId)
          : undefined;

        return {
          id: audit.id,
          reason: audit.reason,
          justification: audit.justification,
          createdAt: audit.createdAt,
          admin: admin
            ? {
                id: admin.id,
                username: admin.username,
                email: admin.email,
              }
            : null,
          message: {
            id: audit.messageId,
            createdAt: message?.createdAt ?? null,
            sender: message?.senderId
              ? this.toUserIdentity(message.senderId)
              : null,
            conversation: conversation
              ? {
                  id: conversation.id,
                  type: conversation.type,
                  name: conversation.name,
                }
              : null,
          },
        };
      }),
      pageInfo: {
        limit,
        offset,
        total: sorted.length,
        hasMore: offset + limit < sorted.length,
      },
    };
  }

  async clearAll() {
    const deletedAdminMessageAccessAudits = this.accessAudits.size;
    if (this.prismaService?.enabled) {
      await this.prismaService.client.adminMessageAccessAudit.deleteMany();
    }
    this.accessAudits.clear();
    return { deletedAdminMessageAccessAudits };
  }

  private toMessageMetadata(
    message: MessageRecord,
    conversation: ConversationRecord,
  ) {
    const attachments = message.attachments ?? [];
    const activeParticipants = conversation.participants.filter(
      (participant) => !participant.leftAt,
    );

    return {
      id: message.id,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      deletedAt: message.deletedAt,
      messageType: message.messageType,
      isForwarded: message.isForwarded,
      sender: message.senderId ? this.toUserIdentity(message.senderId) : null,
      conversation: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        participantCount: activeParticipants.length,
        recipients: activeParticipants
          .filter((participant) => participant.userId !== message.senderId)
          .map((participant) => this.toUserIdentity(participant.userId))
          .filter((user) => user !== null),
      },
      attachmentCount: attachments.length,
      attachmentBytes: attachments.reduce(
        (total, attachment) => total + attachment.fileSize,
        0,
      ),
      contentState: message.deletedAt ? "deleted" : "masked",
    };
  }

  private toUserIdentity(userId: string) {
    const user = this.usersService.findByIdSync(userId);
    return user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
        }
      : null;
  }
}
