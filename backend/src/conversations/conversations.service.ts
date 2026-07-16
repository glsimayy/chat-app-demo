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
  ConversationType as PrismaConversationType,
  MessageType as PrismaMessageType,
  ParticipantRole as PrismaParticipantRole,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { UsersService } from "../users/users.service";
import { UserRole } from "../users/user-role.enum";
import { MetricsService } from "../metrics/metrics.service";
import { ConversationType } from "./conversation-type.enum";
import { ConversationRecord, MessageRecord } from "./conversation.types";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto";
import { CreateGroupConversationDto } from "./dto/create-group-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { FindConversationsQueryDto } from "./dto/find-conversations-query.dto";
import { FindMessagesQueryDto } from "./dto/find-messages-query.dto";
import { SearchMessagesQueryDto } from "./dto/search-messages-query.dto";
import { TransferGroupOwnerDto } from "./dto/transfer-group-owner.dto";
import { UpdateGroupConversationDto } from "./dto/update-group-conversation.dto";
import { UpdateMessageDto } from "./dto/update-message.dto";
import { MessageType } from "./message-type.enum";
import { ParticipantRole } from "./participant-role.enum";
import { RealtimeEventsService } from "./realtime-events.service";

@Injectable()
export class ConversationsService implements OnModuleInit {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly messages = new Map<string, MessageRecord[]>();
  private readonly externalGroupCreations = new Map<
    string,
    Promise<ConversationRecord>
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly metricsService: MetricsService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const persistedConversations =
      await this.prismaService.client.conversation.findMany({
        include: {
          participants: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

    for (const persistedConversation of persistedConversations) {
      const conversation: ConversationRecord = {
        id: persistedConversation.id,
        type: persistedConversation.type as ConversationType,
        name: persistedConversation.name,
        createdBy: persistedConversation.createdBy,
        externalRef: persistedConversation.externalRef,
        participants: persistedConversation.participants.map((participant) => ({
          userId: participant.userId,
          role: participant.role as ParticipantRole,
          joinedAt: participant.joinedAt,
          lastReadAt: participant.lastReadAt,
          leftAt: participant.leftAt,
        })),
        createdAt: persistedConversation.createdAt,
        updatedAt: persistedConversation.updatedAt,
      };
      const messages: MessageRecord[] = persistedConversation.messages.map(
        (message) => ({
          id: message.id,
          clientMessageId: message.clientMessageId,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          messageType: message.messageType as MessageType,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          deletedAt: message.deletedAt,
        }),
      );

      this.conversations.set(conversation.id, conversation);
      this.messages.set(conversation.id, messages);
    }
  }

  async createDirectConversation(
    currentUserId: string,
    dto: CreateDirectConversationDto,
  ) {
    if (dto.participantId === currentUserId) {
      throw new ForbiddenException(
        "You cannot start a conversation with yourself",
      );
    }

    const participant = await this.usersService.findById(dto.participantId);

    if (!participant) {
      throw new NotFoundException("Participant user not found");
    }

    const existingConversation = this.findDirectConversation(
      currentUserId,
      dto.participantId,
    );

    if (existingConversation) {
      return existingConversation;
    }

    const now = new Date();
    const conversation: ConversationRecord = {
      id: crypto.randomUUID(),
      type: ConversationType.Direct,
      name: null,
      createdBy: currentUserId,
      externalRef: null,
      participants: [
        {
          userId: currentUserId,
          role: ParticipantRole.Owner,
          joinedAt: now,
          lastReadAt: now,
          leftAt: null,
        },
        {
          userId: dto.participantId,
          role: ParticipantRole.Member,
          joinedAt: now,
          lastReadAt: now,
          leftAt: null,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await this.persistNewConversation(conversation);
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    this.realtimeEventsService.emit({
      type: "conversation.created",
      data: conversation,
    });

    return conversation;
  }

  async createGroupConversation(
    currentUserId: string,
    dto: CreateGroupConversationDto,
    externalRef: string | null = null,
  ) {
    const now = new Date();
    const participantIds = Array.from(
      new Set([currentUserId, ...dto.participantIds]),
    );

    await this.ensureUsersExist(participantIds);

    const conversation: ConversationRecord = {
      id: crypto.randomUUID(),
      type: ConversationType.Group,
      name: dto.name.trim(),
      createdBy: currentUserId,
      externalRef,
      participants: participantIds.map((userId) => ({
        userId,
        role:
          userId === currentUserId
            ? ParticipantRole.Owner
            : ParticipantRole.Member,
        joinedAt: now,
        lastReadAt: now,
        leftAt: null,
      })),
      createdAt: now,
      updatedAt: now,
    };

    const systemMessage = this.buildSystemMessage(
      conversation.id,
      `Group "${conversation.name}" was created.`,
      now,
    );

    await this.persistNewConversation(conversation, [systemMessage]);
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, [systemMessage]);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "conversation.created",
      data: conversation,
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return conversation;
  }

  async createExternalGroupConversation(
    currentUserId: string,
    dto: CreateGroupConversationDto,
    externalRef?: string,
    initialSystemMessage?: string,
  ) {
    const normalizedExternalRef = externalRef?.trim() || null;

    if (!normalizedExternalRef) {
      const conversation = await this.createGroupConversation(
        currentUserId,
        dto,
      );
      await this.addInitialSystemMessage(conversation.id, initialSystemMessage);
      return conversation;
    }

    const existingConversation = Array.from(this.conversations.values()).find(
      (conversation) => conversation.externalRef === normalizedExternalRef,
    );

    if (existingConversation) {
      return existingConversation;
    }

    const pendingCreation = this.externalGroupCreations.get(
      normalizedExternalRef,
    );

    if (pendingCreation) {
      return pendingCreation;
    }

    const creation = this.createGroupConversation(
      currentUserId,
      dto,
      normalizedExternalRef,
    )
      .then(async (conversation) => {
        await this.addInitialSystemMessage(
          conversation.id,
          initialSystemMessage,
        );
        return conversation;
      })
      .finally(() => {
        this.externalGroupCreations.delete(normalizedExternalRef);
      });

    this.externalGroupCreations.set(normalizedExternalRef, creation);
    return creation;
  }

  async updateGroupConversation(
    conversationId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    dto: UpdateGroupConversationDto,
  ) {
    const conversation = await this.findOneForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanManageParticipants(
      conversation,
      currentUserId,
      currentUserRole,
    );

    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException("Group name cannot be empty");
    }

    if (conversation.name === name) {
      return conversation;
    }

    const oldName = conversation.name;
    const now = new Date();
    conversation.name = name;
    conversation.updatedAt = now;
    const systemMessage = this.buildSystemMessage(
      conversation.id,
      `Group name changed from "${oldName}" to "${name}".`,
      now,
    );
    await this.persistConversationState(conversation, [systemMessage]);
    this.messages.get(conversation.id)?.push(systemMessage);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "conversation.updated",
      data: conversation,
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return conversation;
  }

  async transferGroupOwner(
    conversationId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    dto: TransferGroupOwnerDto,
  ) {
    const conversation = await this.findOneForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanManageParticipants(
      conversation,
      currentUserId,
      currentUserRole,
    );

    const targetParticipant = conversation.participants.find(
      (participant) => participant.userId === dto.userId && !participant.leftAt,
    );

    if (!targetParticipant) {
      throw new NotFoundException("Target participant not found");
    }

    if (targetParticipant.role === ParticipantRole.Owner) {
      return conversation;
    }

    const now = new Date();
    const currentOwners = conversation.participants.filter(
      (participant) => participant.role === ParticipantRole.Owner,
    );

    for (const owner of currentOwners) {
      owner.role = ParticipantRole.Member;
    }

    targetParticipant.role = ParticipantRole.Owner;
    conversation.updatedAt = now;

    const user = await this.usersService.findById(dto.userId);
    const systemMessage = this.buildSystemMessage(
      conversation.id,
      `${user?.username ?? "A user"} is now the group owner.`,
      now,
    );
    await this.persistConversationState(conversation, [systemMessage]);
    this.messages.get(conversation.id)?.push(systemMessage);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "conversation.updated",
      data: conversation,
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return conversation;
  }

  async addSystemEvent(conversationId: string, content: string) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const now = new Date();
    const systemMessage = this.buildSystemMessage(
      conversationId,
      content.trim(),
      now,
    );
    conversation.updatedAt = now;
    await this.persistConversationState(conversation, [systemMessage]);
    this.messages.get(conversation.id)?.push(systemMessage);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "conversation.updated",
      data: conversation,
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });
  }

  async clearAll() {
    const deletedConversations = this.conversations.size;
    const deletedMessageGroups = this.messages.size;

    if (this.prismaService?.enabled) {
      await this.prismaService.client.conversation.deleteMany();
    }

    this.conversations.clear();
    this.messages.clear();
    this.externalGroupCreations.clear();

    return { deletedConversations, deletedMessageGroups };
  }

  async findForUser(userId: string, query: FindConversationsQueryDto = {}) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const search = query.search?.trim().toLowerCase();
    const filteredConversations = Array.from(this.conversations.values())
      .filter((conversation) => this.isParticipant(conversation, userId))
      .filter((conversation) => {
        if (!query.type) {
          return true;
        }

        return conversation.type === query.type;
      })
      .filter((conversation) => {
        if (!search) {
          return true;
        }

        return this.conversationMatchesSearch(conversation, search);
      })
      .map((conversation) => this.toConversationSummary(conversation, userId))
      .sort((left, right) => {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      });

    return {
      items: filteredConversations.slice(offset, offset + limit),
      pageInfo: {
        limit,
        offset,
        total: filteredConversations.length,
        hasMore: offset + limit < filteredConversations.length,
      },
    };
  }

  async findOneForUser(conversationId: string, userId: string) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation || !this.isParticipant(conversation, userId)) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  async createMessage(
    conversationId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    const conversation = await this.findOneForUser(conversationId, userId);
    const content = dto.content.trim();

    if (!content) {
      throw new BadRequestException("Message content cannot be empty");
    }

    const existingMessage = dto.clientMessageId
      ? this.findMessageByClientId(userId, dto.clientMessageId)
      : undefined;

    if (existingMessage) {
      if (
        existingMessage.conversationId !== conversationId ||
        existingMessage.content !== content
      ) {
        throw new ConflictException(
          "clientMessageId has already been used for another message",
        );
      }

      return existingMessage;
    }

    const message: MessageRecord = {
      id: crypto.randomUUID(),
      clientMessageId: dto.clientMessageId ?? null,
      conversationId,
      senderId: userId,
      content,
      messageType: MessageType.User,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    };

    conversation.updatedAt = message.createdAt;
    await this.persistConversationState(conversation, [message]);
    this.messages.get(conversation.id)?.push(message);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({ type: "message.created", data: message });

    return message;
  }

  getActiveConversationIdsForUser(userId: string) {
    return Array.from(this.conversations.values())
      .filter((conversation) => this.isParticipant(conversation, userId))
      .map((conversation) => conversation.id);
  }

  async findMessages(
    conversationId: string,
    userId: string,
    query: FindMessagesQueryDto = {},
  ) {
    await this.findOneForUser(conversationId, userId);
    const limit = query.limit ?? 50;
    const before = query.before ? new Date(query.before) : null;
    const messages = this.messages.get(conversationId) ?? [];
    const filteredMessages = before
      ? messages.filter((message) => message.createdAt < before)
      : messages;
    const pageItems = filteredMessages.slice(-limit);
    const hasMore = filteredMessages.length > pageItems.length;

    return {
      items: pageItems,
      pageInfo: {
        limit,
        before: query.before ?? null,
        nextBefore:
          hasMore && pageItems.length > 0
            ? pageItems[0].createdAt.toISOString()
            : null,
        hasMore,
      },
    };
  }

  async searchMessages(
    conversationId: string,
    userId: string,
    query: SearchMessagesQueryDto,
  ) {
    await this.findOneForUser(conversationId, userId);
    const search = query.q.trim().toLowerCase();
    const limit = query.limit ?? 20;
    const matches = (this.messages.get(conversationId) ?? [])
      .filter((message) => !message.deletedAt)
      .filter((message) => message.content.toLowerCase().includes(search))
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(0, limit);

    return {
      items: matches,
      pageInfo: {
        limit,
        total: matches.length,
      },
    };
  }

  async markAsRead(conversationId: string, userId: string) {
    const conversation = await this.findOneForUser(conversationId, userId);
    const participant = conversation.participants.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (!participant) {
      throw new NotFoundException("Participant not found");
    }

    const readAt = new Date();
    participant.lastReadAt = readAt;
    await this.persistConversationState(conversation);
    this.realtimeEventsService.emit({
      type: "message.read",
      data: { conversationId, userId, readAt },
    });

    return {
      conversationId,
      readAt,
      unreadCount: 0,
    };
  }

  async updateMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    dto: UpdateMessageDto,
  ) {
    const conversation = await this.findOneForUser(conversationId, userId);
    const message = this.findMessageOrThrow(conversation.id, messageId);

    this.ensureMessageCanBeChanged(message, userId);

    const content = dto.content.trim();

    if (!content) {
      throw new BadRequestException("Message content cannot be empty");
    }

    const now = new Date();
    message.content = content;
    message.updatedAt = now;
    conversation.updatedAt = now;
    await this.persistMessageUpdate(message, conversation.updatedAt);
    this.realtimeEventsService.emit({ type: "message.updated", data: message });

    return message;
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
  ) {
    const conversation = await this.findOneForUser(conversationId, userId);
    const message = this.findMessageOrThrow(conversation.id, messageId);

    this.ensureMessageCanBeChanged(message, userId);

    const now = new Date();
    message.content = "";
    message.updatedAt = now;
    message.deletedAt = now;
    conversation.updatedAt = now;
    await this.persistMessageUpdate(message, conversation.updatedAt);
    this.realtimeEventsService.emit({ type: "message.deleted", data: message });

    return message;
  }

  async findParticipants(conversationId: string, userId: string) {
    const conversation = await this.findOneForUser(conversationId, userId);
    return conversation.participants.filter(
      (participant) => !participant.leftAt,
    );
  }

  async leaveConversation(conversationId: string, userId: string) {
    const conversation = await this.findOneForUser(conversationId, userId);
    this.ensureGroupConversation(conversation);

    const participant = conversation.participants.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (!participant) {
      throw new NotFoundException("Participant not found");
    }

    if (participant.role === ParticipantRole.Owner) {
      throw new BadRequestException("Group owner cannot leave the group");
    }

    const user = await this.usersService.findById(userId);
    const now = new Date();
    participant.leftAt = now;
    conversation.updatedAt = now;
    const systemMessage = this.buildSystemMessage(
      conversation.id,
      `${user?.username ?? "A user"} left the group.`,
      now,
    );
    await this.persistConversationState(conversation, [systemMessage]);
    this.messages.get(conversation.id)?.push(systemMessage);
    this.metricsService.recordMessageCreated();
    const leftState = {
      conversationId,
      userId,
      leftAt: now,
    };
    this.realtimeEventsService.emit({
      type: "participant.left",
      data: leftState,
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return leftState;
  }

  async addParticipant(
    conversationId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    dto: AddParticipantDto,
  ) {
    const conversation = await this.findOneForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanManageParticipants(
      conversation,
      currentUserId,
      currentUserRole,
    );

    const user = await this.usersService.findById(dto.userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const existingParticipant = conversation.participants.find(
      (participant) => participant.userId === dto.userId,
    );

    if (existingParticipant && !existingParticipant.leftAt) {
      throw new BadRequestException("User is already a participant");
    }

    const now = new Date();

    if (existingParticipant) {
      existingParticipant.leftAt = null;
      existingParticipant.joinedAt = now;
      existingParticipant.lastReadAt = now;
      existingParticipant.role = ParticipantRole.Member;
    } else {
      conversation.participants.push({
        userId: dto.userId,
        role: ParticipantRole.Member,
        joinedAt: now,
        lastReadAt: now,
        leftAt: null,
      });
    }

    conversation.updatedAt = now;
    const systemMessage = this.buildSystemMessage(
      conversation.id,
      `${user.username} joined the group.`,
      now,
    );
    await this.persistConversationState(conversation, [systemMessage]);
    this.messages.get(conversation.id)?.push(systemMessage);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "conversation.updated",
      data: conversation,
    });
    this.realtimeEventsService.emit({
      type: "participant.added",
      data: { conversationId, userId: dto.userId, joinedAt: now },
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return conversation.participants.filter(
      (participant) => !participant.leftAt,
    );
  }

  async removeParticipant(
    conversationId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    targetUserId: string,
  ) {
    const conversation = await this.findOneForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanManageParticipants(
      conversation,
      currentUserId,
      currentUserRole,
    );

    const participant = conversation.participants.find(
      (item) => item.userId === targetUserId && !item.leftAt,
    );

    if (!participant) {
      throw new NotFoundException("Participant not found");
    }

    if (participant.role === ParticipantRole.Owner) {
      throw new BadRequestException("Group owner cannot be removed");
    }

    const user = await this.usersService.findById(targetUserId);
    const now = new Date();
    participant.leftAt = now;
    conversation.updatedAt = now;
    const systemMessage = this.buildSystemMessage(
      conversation.id,
      `${user?.username ?? "A user"} was removed from the group.`,
      now,
    );
    await this.persistConversationState(conversation, [systemMessage]);
    this.messages.get(conversation.id)?.push(systemMessage);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "participant.removed",
      data: {
        conversationId,
        userId: targetUserId,
        removedAt: now,
        removedBy: currentUserId,
      },
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return conversation.participants.filter((item) => !item.leftAt);
  }

  getActiveParticipantIds(conversationId: string) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      return [];
    }

    return conversation.participants
      .filter((participant) => !participant.leftAt)
      .map((participant) => participant.userId);
  }

  private findDirectConversation(userA: string, userB: string) {
    return Array.from(this.conversations.values()).find((conversation) => {
      if (conversation.type !== ConversationType.Direct) {
        return false;
      }

      const participantIds = conversation.participants.map(
        (participant) => participant.userId,
      );

      return participantIds.includes(userA) && participantIds.includes(userB);
    });
  }

  private conversationMatchesSearch(
    conversation: ConversationRecord,
    search: string,
  ) {
    if (conversation.name?.toLowerCase().includes(search)) {
      return true;
    }

    if (conversation.externalRef?.toLowerCase().includes(search)) {
      return true;
    }

    return conversation.participants.some((participant) => {
      const user = this.usersService.findByIdSync(participant.userId);
      return (
        user?.username.toLowerCase().includes(search) ||
        user?.email.toLowerCase().includes(search)
      );
    });
  }

  private isParticipant(conversation: ConversationRecord, userId: string) {
    return conversation.participants.some(
      (participant) => participant.userId === userId && !participant.leftAt,
    );
  }

  private async ensureUsersExist(userIds: string[]) {
    const missingUserIds: string[] = [];

    for (const userId of userIds) {
      const user = await this.usersService.findById(userId);

      if (!user) {
        missingUserIds.push(userId);
      }
    }

    if (missingUserIds.length > 0) {
      throw new NotFoundException(
        `Users not found: ${missingUserIds.join(", ")}`,
      );
    }
  }

  private ensureGroupConversation(conversation: ConversationRecord) {
    if (conversation.type !== ConversationType.Group) {
      throw new BadRequestException("Conversation is not a group");
    }
  }

  private ensureCanManageParticipants(
    conversation: ConversationRecord,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const currentParticipant = conversation.participants.find(
      (participant) =>
        participant.userId === currentUserId && !participant.leftAt,
    );

    if (
      currentUserRole !== UserRole.Admin &&
      currentParticipant?.role !== ParticipantRole.Owner
    ) {
      throw new ForbiddenException("You cannot manage this group");
    }
  }

  private buildSystemMessage(
    conversationId: string,
    content: string,
    createdAt = new Date(),
  ) {
    const message: MessageRecord = {
      id: crypto.randomUUID(),
      clientMessageId: null,
      conversationId,
      senderId: null,
      content,
      messageType: MessageType.System,
      createdAt,
      updatedAt: null,
      deletedAt: null,
    };

    return message;
  }

  private async addInitialSystemMessage(
    conversationId: string,
    initialSystemMessage?: string,
  ) {
    if (initialSystemMessage?.trim()) {
      await this.addSystemEvent(conversationId, initialSystemMessage);
    }
  }

  private async persistNewConversation(
    conversation: ConversationRecord,
    initialMessages: MessageRecord[] = [],
  ) {
    if (!this.prismaService?.enabled) {
      return;
    }

    await this.prismaService.client.conversation.create({
      data: {
        id: conversation.id,
        type: conversation.type as unknown as PrismaConversationType,
        name: conversation.name,
        createdBy: conversation.createdBy,
        externalRef: conversation.externalRef ?? null,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        participants: {
          create: conversation.participants.map((participant) => ({
            userId: participant.userId,
            role: participant.role as unknown as PrismaParticipantRole,
            joinedAt: participant.joinedAt,
            lastReadAt: participant.lastReadAt,
            leftAt: participant.leftAt,
          })),
        },
        messages:
          initialMessages.length > 0
            ? {
                create: initialMessages.map((message) => ({
                  id: message.id,
                  clientMessageId: message.clientMessageId,
                  senderId: message.senderId,
                  content: message.content,
                  messageType:
                    message.messageType as unknown as PrismaMessageType,
                  createdAt: message.createdAt,
                  updatedAt: message.updatedAt,
                  deletedAt: message.deletedAt,
                })),
              }
            : undefined,
      },
    });
  }

  private async persistConversationState(
    conversation: ConversationRecord,
    newMessages: MessageRecord[] = [],
  ) {
    if (!this.prismaService?.enabled) {
      return;
    }

    await this.prismaService.client.$transaction(async (transaction) => {
      await transaction.conversation.update({
        where: { id: conversation.id },
        data: {
          name: conversation.name,
          externalRef: conversation.externalRef ?? null,
          updatedAt: conversation.updatedAt,
        },
      });

      for (const participant of conversation.participants) {
        await transaction.conversationParticipant.upsert({
          where: {
            conversationId_userId: {
              conversationId: conversation.id,
              userId: participant.userId,
            },
          },
          create: {
            conversationId: conversation.id,
            userId: participant.userId,
            role: participant.role as unknown as PrismaParticipantRole,
            joinedAt: participant.joinedAt,
            lastReadAt: participant.lastReadAt,
            leftAt: participant.leftAt,
          },
          update: {
            role: participant.role as unknown as PrismaParticipantRole,
            joinedAt: participant.joinedAt,
            lastReadAt: participant.lastReadAt,
            leftAt: participant.leftAt,
          },
        });
      }

      for (const message of newMessages) {
        await transaction.message.create({
          data: this.toPersistedMessage(message),
        });
      }
    });
  }

  private async persistMessageUpdate(
    message: MessageRecord,
    conversationUpdatedAt: Date,
  ) {
    if (!this.prismaService?.enabled) {
      return;
    }

    await this.prismaService.client.$transaction([
      this.prismaService.client.message.update({
        where: { id: message.id },
        data: {
          content: message.content,
          updatedAt: message.updatedAt,
          deletedAt: message.deletedAt,
        },
      }),
      this.prismaService.client.conversation.update({
        where: { id: message.conversationId },
        data: { updatedAt: conversationUpdatedAt },
      }),
    ]);
  }

  private toPersistedMessage(message: MessageRecord) {
    return {
      id: message.id,
      clientMessageId: message.clientMessageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType as unknown as PrismaMessageType,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      deletedAt: message.deletedAt,
    };
  }

  private findMessageOrThrow(conversationId: string, messageId: string) {
    const message = (this.messages.get(conversationId) ?? []).find(
      (item) => item.id === messageId,
    );

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    return message;
  }

  private findMessageByClientId(userId: string, clientMessageId: string) {
    for (const messages of this.messages.values()) {
      const message = messages.find(
        (item) =>
          item.senderId === userId && item.clientMessageId === clientMessageId,
      );

      if (message) {
        return message;
      }
    }

    return undefined;
  }

  private ensureMessageCanBeChanged(message: MessageRecord, userId: string) {
    if (message.messageType !== MessageType.User) {
      throw new BadRequestException("System messages cannot be changed");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException("You can only change your own messages");
    }

    if (message.deletedAt) {
      throw new BadRequestException("Deleted messages cannot be changed");
    }
  }

  private toConversationSummary(
    conversation: ConversationRecord,
    userId: string,
  ) {
    const participant = conversation.participants.find(
      (item) => item.userId === userId && !item.leftAt,
    );
    const messages = this.messages.get(conversation.id) ?? [];
    const lastMessage = messages.at(-1) ?? null;
    const lastReadAt = participant?.lastReadAt ?? null;
    const unreadCount = messages.filter((message) => {
      if (message.senderId === userId) {
        return false;
      }

      if (!lastReadAt) {
        return true;
      }

      return message.createdAt > lastReadAt;
    }).length;

    return {
      ...conversation,
      participantCount: conversation.participants.filter((item) => !item.leftAt)
        .length,
      lastMessage,
      unreadCount,
    };
  }
}
