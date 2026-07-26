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
  ConversationStatus as PrismaConversationStatus,
  ConversationType as PrismaConversationType,
  MessageType as PrismaMessageType,
  ParticipantRole as PrismaParticipantRole,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { UsersService } from "../users/users.service";
import { UserRole } from "../users/user-role.enum";
import { PublicUser } from "../users/user.types";
import { MetricsService } from "../metrics/metrics.service";
import { ConversationType } from "./conversation-type.enum";
import { ConversationStatus } from "./conversation-status.enum";
import {
  ConversationRecord,
  ExternalGroupConversationResult,
  MessageRecord,
  UploadedMessageFile,
} from "./conversation.types";
import {
  ALLOWED_MESSAGE_ATTACHMENT_TYPES,
  MAX_MESSAGE_ATTACHMENT_BYTES,
  MAX_MESSAGE_ATTACHMENTS,
} from "./attachment.config";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto";
import { CreateGroupConversationDto } from "./dto/create-group-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { CreateMessageWithAttachmentsDto } from "./dto/create-message-with-attachments.dto";
import { FindConversationsQueryDto } from "./dto/find-conversations-query.dto";
import { FindMessagesQueryDto } from "./dto/find-messages-query.dto";
import { SearchMessagesQueryDto } from "./dto/search-messages-query.dto";
import { TransferGroupOwnerDto } from "./dto/transfer-group-owner.dto";
import { UpdateGroupConversationDto } from "./dto/update-group-conversation.dto";
import { UpdateMessageDto } from "./dto/update-message.dto";
import { UpdateParticipantRoleDto } from "./dto/update-participant-role.dto";
import { MessageType } from "./message-type.enum";
import { ParticipantRole } from "./participant-role.enum";
import { RealtimeEventsService } from "./realtime-events.service";

interface ConversationPreferenceRecord {
  userId: string;
  conversationId: string;
  isBookmarked: boolean;
  isArchived: boolean;
  isDeleted: boolean;
}

type ConversationPreferenceUpdates = Partial<
  Pick<
    ConversationPreferenceRecord,
    "isBookmarked" | "isArchived" | "isDeleted"
  >
>;

@Injectable()
export class ConversationsService implements OnModuleInit {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly messages = new Map<string, MessageRecord[]>();
  private readonly attachmentData = new Map<string, Buffer>();
  private readonly conversationPreferences = new Map<
    string,
    ConversationPreferenceRecord
  >();
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
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              attachments: {
                select: {
                  id: true,
                  fileName: true,
                  mimeType: true,
                  fileSize: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

    for (const persistedConversation of persistedConversations) {
      const conversation: ConversationRecord = {
        id: persistedConversation.id,
        type: persistedConversation.type as ConversationType,
        name: persistedConversation.name,
        description: persistedConversation.description,
        createdBy: persistedConversation.createdBy,
        externalRef: persistedConversation.externalRef,
        isBotManaged: persistedConversation.isBotManaged,
        sourceName: persistedConversation.sourceName,
        memberCanSendMessages: persistedConversation.memberCanSendMessages,
        membersCanLeave: persistedConversation.membersCanLeave,
        status: persistedConversation.status as ConversationStatus,
        parentConversationId: persistedConversation.parentConversationId,
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
          replyToMessageId: message.replyToMessageId,
          content: message.content,
          messageType: message.messageType as MessageType,
          isForwarded: message.isForwarded,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          deletedAt: message.deletedAt,
          attachments: message.attachments,
        }),
      );

      this.conversations.set(conversation.id, conversation);
      this.messages.set(conversation.id, messages);
    }

    const preferenceClient = this.prismaService.client.conversationPreference;
    const persistedPreferences = preferenceClient
      ? await preferenceClient.findMany()
      : [];

    for (const preference of persistedPreferences) {
      this.conversationPreferences.set(
        this.conversationPreferenceKey(
          preference.userId,
          preference.conversationId,
        ),
        preference,
      );
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

    const currentUser = await this.usersService.findById(currentUserId);

    if (participant.isBot || currentUser?.isBot) {
      throw new BadRequestException(
        "Direct conversations with automation bots are not allowed",
      );
    }

    const existingConversation = this.findDirectConversation(
      currentUserId,
      dto.participantId,
    );

    if (existingConversation) {
      await this.setConversationPreference(
        existingConversation.id,
        currentUserId,
        { isDeleted: false },
      );
      return this.withConversationPreference(
        existingConversation,
        currentUserId,
      );
    }

    const now = new Date();
    const conversation: ConversationRecord = {
      id: crypto.randomUUID(),
      type: ConversationType.Direct,
      name: null,
      description: null,
      createdBy: currentUserId,
      externalRef: null,
      isBotManaged: false,
      sourceName: null,
      memberCanSendMessages: true,
      membersCanLeave: true,
      status: ConversationStatus.Active,
      parentConversationId: null,
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

  hasDirectConversation(currentUserId: string, participantId: string) {
    return Boolean(this.findDirectConversation(currentUserId, participantId));
  }

  findContactsForUser(userId: string): PublicUser[] {
    const contactIds = new Set<string>();

    for (const conversation of this.conversations.values()) {
      if (
        conversation.type !== ConversationType.Direct ||
        conversation.status !== ConversationStatus.Active ||
        !this.isParticipant(conversation, userId)
      ) {
        continue;
      }

      for (const participant of conversation.participants) {
        if (participant.userId !== userId && !participant.leftAt) {
          contactIds.add(participant.userId);
        }
      }
    }

    return Array.from(contactIds)
      .reduce<PublicUser[]>((contacts, contactId) => {
        const user = this.usersService.findByIdSync(contactId);

        if (user && !user.isBot) {
          contacts.push(user);
        }

        return contacts;
      }, [])
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  async createGroupConversation(
    currentUserId: string,
    dto: CreateGroupConversationDto,
    externalRef: string | null = null,
  ) {
    return this.createGroup({
      createdBy: currentUserId,
      ownerId: currentUserId,
      dto,
      externalRef,
      isBotManaged: false,
      sourceName: null,
    });
  }

  private async createGroup(options: {
    createdBy: string;
    ownerId: string | null;
    dto: CreateGroupConversationDto;
    externalRef: string | null;
    isBotManaged: boolean;
    sourceName: string | null;
  }) {
    const { createdBy, ownerId, dto, externalRef, isBotManaged, sourceName } =
      options;
    const now = new Date();
    const managerIds = new Set(dto.managerIds ?? []);
    const participantIds = Array.from(
      new Set([
        ...(ownerId ? [ownerId] : []),
        ...dto.participantIds,
        ...managerIds,
      ]),
    );

    await this.ensureUsersExist(participantIds);

    const conversation: ConversationRecord = {
      id: crypto.randomUUID(),
      type: ConversationType.Group,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      createdBy,
      externalRef,
      isBotManaged,
      sourceName: sourceName?.trim() || null,
      memberCanSendMessages: dto.memberCanSendMessages ?? false,
      membersCanLeave: dto.membersCanLeave ?? !isBotManaged,
      status: ConversationStatus.Active,
      parentConversationId: null,
      participants: participantIds.map((userId) => ({
        userId,
        role:
          userId === ownerId
            ? ParticipantRole.Owner
            : managerIds.has(userId)
              ? ParticipantRole.Manager
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
    const managementConversation = await this.buildManagementConversation(
      conversation,
      now,
    );

    await this.persistNewConversation(conversation, [systemMessage]);
    await this.persistNewConversation(managementConversation);
    this.conversations.set(conversation.id, conversation);
    this.conversations.set(managementConversation.id, managementConversation);
    this.messages.set(conversation.id, [systemMessage]);
    this.messages.set(managementConversation.id, []);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "conversation.created",
      data: conversation,
    });
    this.realtimeEventsService.emit({
      type: "conversation.created",
      data: managementConversation,
    });
    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return conversation;
  }

  async createExternalGroupConversation(
    botUserId: string,
    dto: CreateGroupConversationDto,
    externalRef?: string,
    initialMessage?: string,
    sourceName?: string,
  ): Promise<ExternalGroupConversationResult> {
    const normalizedExternalRef = externalRef?.trim() || null;

    if (!normalizedExternalRef) {
      const conversation = await this.createGroup({
        createdBy: botUserId,
        ownerId: null,
        dto,
        externalRef: null,
        isBotManaged: true,
        sourceName: sourceName ?? null,
      });
      await this.addInitialMessage(conversation.id, initialMessage, botUserId);
      return { ...conversation, created: true, reused: false };
    }

    const existingConversation = Array.from(this.conversations.values()).find(
      (conversation) => conversation.externalRef === normalizedExternalRef,
    );

    if (existingConversation) {
      return { ...existingConversation, created: false, reused: true };
    }

    const pendingCreation = this.externalGroupCreations.get(
      normalizedExternalRef,
    );

    if (pendingCreation) {
      const conversation = await pendingCreation;
      return { ...conversation, created: false, reused: true };
    }

    const creation = this.createGroup({
      createdBy: botUserId,
      ownerId: null,
      dto,
      externalRef: normalizedExternalRef,
      isBotManaged: true,
      sourceName: sourceName ?? null,
    })
      .then(async (conversation) => {
        await this.addInitialMessage(
          conversation.id,
          initialMessage,
          botUserId,
        );
        return conversation;
      })
      .finally(() => {
        this.externalGroupCreations.delete(normalizedExternalRef);
      });

    this.externalGroupCreations.set(normalizedExternalRef, creation);
    const conversation = await creation;
    return { ...conversation, created: true, reused: false };
  }

  async addExternalParticipants(
    conversationId: string,
    botUserId: string,
    participantIds: string[],
    managerIds: string[] = [],
  ) {
    const conversation = this.findAutomationGroup(conversationId, botUserId);
    const managerIdSet = new Set(managerIds);
    const uniqueParticipantIds = Array.from(
      new Set([...participantIds, ...managerIdSet]),
    );
    await this.ensureUsersExist(uniqueParticipantIds);

    const now = new Date();
    const addedUserIds: string[] = [];

    for (const userId of uniqueParticipantIds) {
      const existingParticipant = conversation.participants.find(
        (participant) => participant.userId === userId,
      );

      if (existingParticipant && !existingParticipant.leftAt) {
        if (
          managerIdSet.has(userId) &&
          existingParticipant.role !== ParticipantRole.Manager
        ) {
          existingParticipant.role = ParticipantRole.Manager;
          addedUserIds.push(userId);
        }
        continue;
      }

      if (existingParticipant) {
        existingParticipant.leftAt = null;
        existingParticipant.joinedAt = now;
        existingParticipant.lastReadAt = now;
        existingParticipant.role = managerIdSet.has(userId)
          ? ParticipantRole.Manager
          : ParticipantRole.Member;
      } else {
        conversation.participants.push({
          userId,
          role: managerIdSet.has(userId)
            ? ParticipantRole.Manager
            : ParticipantRole.Member,
          joinedAt: now,
          lastReadAt: now,
          leftAt: null,
        });
      }

      addedUserIds.push(userId);
    }

    if (addedUserIds.length === 0) {
      return conversation.participants.filter(
        (participant) => !participant.leftAt,
      );
    }

    const addedUsers = await Promise.all(
      addedUserIds.map((userId) => this.usersService.findById(userId)),
    );
    const usernames = addedUsers.map((user) => user?.username ?? "A user");
    const systemMessage = this.buildSystemMessage(
      conversationId,
      `${usernames.join(", ")} joined through automation.`,
      now,
    );

    conversation.updatedAt = now;
    await this.syncManagementParticipants(conversation, now);
    await this.persistConversationState(conversation, [systemMessage]);
    this.messages.get(conversation.id)?.push(systemMessage);
    this.metricsService.recordMessageCreated();
    this.realtimeEventsService.emit({
      type: "conversation.updated",
      data: conversation,
    });

    for (const userId of addedUserIds) {
      this.realtimeEventsService.emit({
        type: "participant.added",
        data: { conversationId, userId, joinedAt: now },
      });
    }

    this.realtimeEventsService.emit({
      type: "message.created",
      data: systemMessage,
    });

    return conversation.participants.filter(
      (participant) => !participant.leftAt,
    );
  }

  async createExternalMessage(
    conversationId: string,
    botUserId: string,
    dto: CreateMessageDto,
  ) {
    this.findAutomationGroup(conversationId, botUserId);
    return this.createMessage(conversationId, botUserId, dto);
  }

  async updateExternalGroup(
    conversationId: string,
    botUserId: string,
    dto: UpdateGroupConversationDto,
  ) {
    this.findAutomationGroup(conversationId, botUserId);
    return this.updateGroupConversation(
      conversationId,
      botUserId,
      UserRole.Admin,
      dto,
    );
  }

  async updateExternalParticipantRole(
    conversationId: string,
    botUserId: string,
    targetUserId: string,
    dto: UpdateParticipantRoleDto,
  ) {
    this.findAutomationGroup(conversationId, botUserId);
    return this.updateParticipantRole(
      conversationId,
      botUserId,
      UserRole.Admin,
      targetUserId,
      dto,
    );
  }

  async updateGroupConversation(
    conversationId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    dto: UpdateGroupConversationDto,
  ) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanManageGroup(conversation, currentUserId, currentUserRole);
    const settingsChanged =
      dto.memberCanSendMessages !== undefined ||
      dto.membersCanLeave !== undefined ||
      dto.status !== undefined;

    if (settingsChanged) {
      this.ensureCanChangeGroupSettings(
        conversation,
        currentUserId,
        currentUserRole,
      );
    }

    const now = new Date();
    const changes: string[] = [];

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException("Group name cannot be empty");
      }

      if (name !== conversation.name) {
        changes.push(
          `Group name changed from "${conversation.name}" to "${name}".`,
        );
        conversation.name = name;
      }
    }

    if (dto.description !== undefined) {
      const description = dto.description.trim() || null;

      if (description !== conversation.description) {
        conversation.description = description;
        changes.push("Group description was updated.");
      }
    }

    if (
      dto.memberCanSendMessages !== undefined &&
      dto.memberCanSendMessages !== conversation.memberCanSendMessages
    ) {
      conversation.memberCanSendMessages = dto.memberCanSendMessages;
      changes.push(
        dto.memberCanSendMessages
          ? "Members can now send messages."
          : "Only group management can send messages.",
      );
    }

    if (
      dto.membersCanLeave !== undefined &&
      dto.membersCanLeave !== conversation.membersCanLeave
    ) {
      conversation.membersCanLeave = dto.membersCanLeave;
      changes.push(
        dto.membersCanLeave
          ? "Members can now leave the group."
          : "Members can no longer leave the group.",
      );
    }

    if (dto.status !== undefined && dto.status !== conversation.status) {
      conversation.status = dto.status;
      changes.push(`Group status changed to ${dto.status}.`);
    }

    if (changes.length === 0) {
      return conversation;
    }

    conversation.updatedAt = now;
    const systemMessage = this.buildSystemMessage(
      conversation.id,
      changes.join(" "),
      now,
    );
    const managementConversation = this.findManagementConversationRecord(
      conversation.id,
    );

    if (managementConversation) {
      managementConversation.name = `${conversation.name} - Manager Chat`;
      managementConversation.status = conversation.status;
      managementConversation.updatedAt = now;
      await this.persistConversationState(managementConversation);
    }
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
    const conversation = this.findConversationRecordForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanChangeGroupSettings(
      conversation,
      currentUserId,
      currentUserRole,
    );

    if (conversation.isBotManaged) {
      throw new BadRequestException("BOT groups do not have an owner");
    }

    const targetParticipant = conversation.participants.find(
      (participant) => participant.userId === dto.userId && !participant.leftAt,
    );

    if (!targetParticipant) {
      throw new NotFoundException("Target participant not found");
    }

    const user = await this.usersService.findById(dto.userId);

    if (user?.isBot) {
      throw new BadRequestException(
        "Automation bot cannot become the group owner",
      );
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
    await this.syncManagementParticipants(conversation, now);

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

  async updateParticipantRole(
    conversationId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    targetUserId: string,
    dto: UpdateParticipantRoleDto,
  ) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanChangeGroupSettings(
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
      throw new BadRequestException("Group owner role cannot be changed");
    }

    const user = await this.usersService.findById(targetUserId);

    if (user?.isBot) {
      throw new BadRequestException("Automation bot cannot be a manager");
    }

    if (participant.role === dto.role) {
      return conversation;
    }

    const now = new Date();
    participant.role = dto.role;
    conversation.updatedAt = now;
    await this.syncManagementParticipants(conversation, now);
    const systemMessage = this.buildSystemMessage(
      conversation.id,
      `${user?.username ?? "A user"} is now a ${dto.role}.`,
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

  async findManagementConversation(groupId: string, userId: string) {
    const group = this.findConversationRecordForUser(groupId, userId);
    this.ensureGroupConversation(group);

    if (!this.canAccessManagementConversation(group, userId)) {
      throw new NotFoundException("Management conversation not found");
    }

    let managementConversation = this.findManagementConversationRecord(
      group.id,
    );

    if (!managementConversation) {
      managementConversation = await this.buildManagementConversation(
        group,
        new Date(),
      );
      await this.persistNewConversation(managementConversation);
      this.conversations.set(managementConversation.id, managementConversation);
      this.messages.set(managementConversation.id, []);
      this.realtimeEventsService.emit({
        type: "conversation.created",
        data: managementConversation,
      });
    } else {
      await this.syncManagementParticipants(group);
    }

    return managementConversation;
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
    this.attachmentData.clear();
    this.conversationPreferences.clear();
    this.externalGroupCreations.clear();

    return { deletedConversations, deletedMessageGroups };
  }

  async findForUser(userId: string, query: FindConversationsQueryDto = {}) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const search = query.search?.trim().toLowerCase();
    const filteredConversations = Array.from(this.conversations.values())
      .filter(
        (conversation) => conversation.type !== ConversationType.Management,
      )
      .filter((conversation) => this.isParticipant(conversation, userId))
      .filter(
        (conversation) =>
          !this.getConversationPreference(conversation.id, userId).isDeleted,
      )
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
    return this.withConversationPreference(
      this.findConversationRecordForUser(conversationId, userId),
      userId,
    );
  }

  private findConversationRecordForUser(
    conversationId: string,
    userId: string,
  ) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.type === ConversationType.Management) {
      const parent = conversation.parentConversationId
        ? this.conversations.get(conversation.parentConversationId)
        : undefined;

      if (!parent || !this.canAccessManagementConversation(parent, userId)) {
        throw new NotFoundException("Conversation not found");
      }

      return conversation;
    }

    if (!this.isParticipant(conversation, userId)) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  async toggleConversationBookmark(conversationId: string, userId: string) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    const current = this.getConversationPreference(conversationId, userId);
    await this.setConversationPreference(conversationId, userId, {
      isBookmarked: !current.isBookmarked,
      isDeleted: false,
    });

    return this.withConversationPreference(conversation, userId);
  }

  async toggleConversationArchive(conversationId: string, userId: string) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    const current = this.getConversationPreference(conversationId, userId);
    await this.setConversationPreference(conversationId, userId, {
      isArchived: !current.isArchived,
      isDeleted: false,
    });

    return this.withConversationPreference(conversation, userId);
  }

  async deleteConversationForUser(conversationId: string, userId: string) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    await this.setConversationPreference(conversationId, userId, {
      isBookmarked: false,
      isArchived: false,
      isDeleted: true,
    });

    return {
      id: conversation.id,
      deleted: true,
    };
  }

  async createMessage(
    conversationId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    this.ensureCanSendMessage(conversation, userId);
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
        existingMessage.content !== content ||
        existingMessage.replyToMessageId !== (dto.replyToMessageId ?? null) ||
        existingMessage.isForwarded !== Boolean(dto.isForwarded)
      ) {
        throw new ConflictException(
          "clientMessageId has already been used for another message",
        );
      }

      return this.withReplyReference(existingMessage);
    }

    this.validateReplyTarget(conversationId, dto.replyToMessageId);
    const message: MessageRecord = {
      id: crypto.randomUUID(),
      clientMessageId: dto.clientMessageId ?? null,
      conversationId,
      senderId: userId,
      replyToMessageId: dto.replyToMessageId ?? null,
      content,
      messageType: MessageType.User,
      isForwarded: Boolean(dto.isForwarded),
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      attachments: [],
    };

    conversation.updatedAt = message.createdAt;
    await this.restoreDeletedConversationForParticipants(conversation);
    await this.persistConversationState(conversation, [message]);
    this.messages.get(conversation.id)?.push(message);
    this.metricsService.recordMessageCreated();
    const messageView = this.withReplyReference(message);
    this.realtimeEventsService.emit({
      type: "message.created",
      data: messageView,
    });

    return messageView;
  }

  async createMessageWithAttachments(
    conversationId: string,
    userId: string,
    dto: CreateMessageWithAttachmentsDto,
    files: UploadedMessageFile[],
  ) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    this.ensureCanSendMessage(conversation, userId);
    this.validateAttachmentFiles(files);
    const content = dto.content?.trim() ?? "";

    if (!content && files.length === 0) {
      throw new BadRequestException("A message or attachment is required");
    }

    const existingMessage = dto.clientMessageId
      ? this.findMessageByClientId(userId, dto.clientMessageId)
      : undefined;

    if (existingMessage) {
      if (
        existingMessage.conversationId !== conversationId ||
        existingMessage.content !== content ||
        existingMessage.replyToMessageId !== (dto.replyToMessageId ?? null) ||
        existingMessage.isForwarded !== Boolean(dto.isForwarded)
      ) {
        throw new ConflictException(
          "clientMessageId has already been used for another message",
        );
      }

      return this.withReplyReference(existingMessage);
    }

    this.validateReplyTarget(conversationId, dto.replyToMessageId);
    const createdAt = new Date();
    const attachments = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: this.normalizeAttachmentFileName(file.originalname),
      mimeType: file.mimetype.toLowerCase(),
      fileSize: file.size,
      createdAt,
    }));
    const message: MessageRecord = {
      id: crypto.randomUUID(),
      clientMessageId: dto.clientMessageId ?? null,
      conversationId,
      senderId: userId,
      replyToMessageId: dto.replyToMessageId ?? null,
      content,
      messageType: MessageType.User,
      isForwarded: Boolean(dto.isForwarded),
      createdAt,
      updatedAt: null,
      deletedAt: null,
      attachments,
    };

    conversation.updatedAt = createdAt;
    await this.restoreDeletedConversationForParticipants(conversation);
    await this.persistMessageWithAttachments(conversation, message, files);

    if (!this.prismaService?.enabled) {
      attachments.forEach((attachment, index) => {
        this.attachmentData.set(
          attachment.id,
          Buffer.from(files[index].buffer),
        );
      });
    }

    this.messages.get(conversation.id)?.push(message);
    this.metricsService.recordMessageCreated();
    const messageView = this.withReplyReference(message);
    this.realtimeEventsService.emit({
      type: "message.created",
      data: messageView,
    });

    return messageView;
  }

  async getAttachment(
    conversationId: string,
    attachmentId: string,
    userId: string,
  ) {
    this.findConversationRecordForUser(conversationId, userId);
    const message = (this.messages.get(conversationId) ?? []).find(
      (item) =>
        !item.deletedAt &&
        item.attachments?.some((attachment) => attachment.id === attachmentId),
    );
    const attachment = message?.attachments?.find(
      (item) => item.id === attachmentId,
    );

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    if (this.prismaService?.enabled) {
      const persistedAttachment =
        await this.prismaService.client.messageAttachment.findUnique({
          where: { id: attachmentId },
          select: { data: true },
        });

      if (!persistedAttachment) {
        throw new NotFoundException("Attachment not found");
      }

      return {
        attachment,
        data: Buffer.from(persistedAttachment.data),
      };
    }

    const data = this.attachmentData.get(attachmentId);

    if (!data) {
      throw new NotFoundException("Attachment not found");
    }

    return { attachment, data };
  }

  getActiveConversationIdsForUser(userId: string) {
    return Array.from(this.conversations.values())
      .filter((conversation) => {
        if (conversation.type !== ConversationType.Management) {
          return this.isParticipant(conversation, userId);
        }

        const parent = conversation.parentConversationId
          ? this.conversations.get(conversation.parentConversationId)
          : undefined;
        return Boolean(
          parent && this.canAccessManagementConversation(parent, userId),
        );
      })
      .map((conversation) => conversation.id);
  }

  async findMessages(
    conversationId: string,
    userId: string,
    query: FindMessagesQueryDto = {},
  ) {
    this.findConversationRecordForUser(conversationId, userId);
    const limit = query.limit ?? 50;
    const before = query.before ? new Date(query.before) : null;
    const messages = this.messages.get(conversationId) ?? [];
    const filteredMessages = before
      ? messages.filter((message) => message.createdAt < before)
      : messages;
    const pageItems = filteredMessages.slice(-limit);
    const hasMore = filteredMessages.length > pageItems.length;

    return {
      items: pageItems.map((message) => this.withReplyReference(message)),
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
    this.findConversationRecordForUser(conversationId, userId);
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
      items: matches.map((message) => this.withReplyReference(message)),
      pageInfo: {
        limit,
        total: matches.length,
      },
    };
  }

  async findMessageForUser(messageId: string, userId: string) {
    for (const [conversationId, messages] of this.messages.entries()) {
      const message = messages.find((item) => item.id === messageId);

      if (!message) {
        continue;
      }

      const conversation = this.findConversationRecordForUser(
        conversationId,
        userId,
      );

      if (message.deletedAt) {
        throw new NotFoundException("Message not found");
      }

      return {
        conversation,
        message: this.withReplyReference(message),
      };
    }

    throw new NotFoundException("Message not found");
  }

  async markAsRead(conversationId: string, userId: string) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
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

  async markAsUnread(
    conversationId: string,
    messageId: string,
    userId: string,
  ) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    const participant = conversation.participants.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (!participant) {
      throw new NotFoundException("Participant not found");
    }

    const selectedMessage = this.findMessageOrThrow(conversationId, messageId);
    const readAt = new Date(selectedMessage.createdAt.getTime() - 1);
    participant.lastReadAt = readAt;
    await this.persistConversationState(conversation);

    const unreadCount = (this.messages.get(conversationId) ?? []).filter(
      (message) =>
        !message.deletedAt &&
        message.senderId !== userId &&
        message.createdAt > readAt,
    ).length;

    this.realtimeEventsService.emit({
      type: "message.read",
      data: { conversationId, userId, readAt },
    });

    return {
      conversationId,
      readAt,
      unreadCount,
    };
  }

  async updateMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    dto: UpdateMessageDto,
  ) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    const message = this.findMessageOrThrow(conversation.id, messageId);

    this.ensureCanSendMessage(conversation, userId);
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
    const messageView = this.withReplyReference(message);
    this.realtimeEventsService.emit({
      type: "message.updated",
      data: messageView,
    });

    return messageView;
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
  ) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    const message = this.findMessageOrThrow(conversation.id, messageId);

    this.ensureMessageCanBeChanged(message, userId);

    const now = new Date();
    message.content = "";
    message.updatedAt = now;
    message.deletedAt = now;
    conversation.updatedAt = now;
    await this.persistMessageUpdate(message, conversation.updatedAt);
    for (const attachment of message.attachments ?? []) {
      this.attachmentData.delete(attachment.id);
    }
    message.attachments = [];
    const messageView = this.withReplyReference(message);
    this.realtimeEventsService.emit({
      type: "message.deleted",
      data: messageView,
    });

    return messageView;
  }

  async findParticipants(conversationId: string, userId: string) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
    return conversation.participants.filter(
      (participant) => !participant.leftAt,
    );
  }

  async leaveConversation(conversationId: string, userId: string) {
    const conversation = this.findConversationRecordForUser(
      conversationId,
      userId,
    );
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

    if (!conversation.membersCanLeave) {
      throw new ForbiddenException("Members cannot leave this group");
    }

    const user = await this.usersService.findById(userId);
    const now = new Date();
    participant.leftAt = now;
    conversation.updatedAt = now;
    await this.syncManagementParticipants(conversation, now);
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
    const conversation = this.findConversationRecordForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanManageGroup(conversation, currentUserId, currentUserRole);

    const user = await this.usersService.findById(dto.userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isBot) {
      throw new BadRequestException(
        "Bot membership is managed by the automation API",
      );
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
    await this.syncManagementParticipants(conversation, now);
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
    const conversation = this.findConversationRecordForUser(
      conversationId,
      currentUserId,
    );
    this.ensureGroupConversation(conversation);
    this.ensureCanManageGroup(conversation, currentUserId, currentUserRole);

    const participant = conversation.participants.find(
      (item) => item.userId === targetUserId && !item.leftAt,
    );

    if (!participant) {
      throw new NotFoundException("Participant not found");
    }

    const user = await this.usersService.findById(targetUserId);

    if (user?.isBot) {
      throw new BadRequestException(
        "Automation bot cannot be removed from its group",
      );
    }

    if (participant.role === ParticipantRole.Owner) {
      throw new BadRequestException("Group owner cannot be removed");
    }

    const actorParticipant = conversation.participants.find(
      (item) => item.userId === currentUserId && !item.leftAt,
    );

    if (
      actorParticipant?.role === ParticipantRole.Manager &&
      participant.role !== ParticipantRole.Member
    ) {
      throw new ForbiddenException("Managers can only remove regular members");
    }

    if (user?.role === UserRole.Admin && currentUserRole !== UserRole.Admin) {
      throw new BadRequestException(
        "Global admins cannot be removed by group management",
      );
    }

    const now = new Date();
    participant.leftAt = now;
    conversation.updatedAt = now;
    await this.syncManagementParticipants(conversation, now);
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

    const participants = conversation.participants
      .filter((participant) => !participant.leftAt)
      .map((participant) => participant.userId);

    if (conversation.type !== ConversationType.Management) {
      return participants;
    }

    const parent = conversation.parentConversationId
      ? this.conversations.get(conversation.parentConversationId)
      : undefined;

    return parent
      ? participants.filter((userId) =>
          this.canAccessManagementConversation(parent, userId),
        )
      : [];
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

  private ensureCanManageGroup(
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
      currentParticipant?.role !== ParticipantRole.Owner &&
      currentParticipant?.role !== ParticipantRole.Manager
    ) {
      throw new ForbiddenException("You cannot manage this group");
    }
  }

  private ensureCanChangeGroupSettings(
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
      throw new ForbiddenException("You cannot change group settings");
    }
  }

  private ensureCanSendMessage(
    conversation: ConversationRecord,
    userId: string,
  ) {
    if (
      conversation.type === ConversationType.Direct &&
      this.hasAutomationBotParticipant(conversation)
    ) {
      throw new ForbiddenException(
        "Direct messages to automation bots are not allowed",
      );
    }

    let policyConversation = conversation;

    if (conversation.type === ConversationType.Management) {
      const parent = conversation.parentConversationId
        ? this.conversations.get(conversation.parentConversationId)
        : undefined;

      if (!parent || !this.canAccessManagementConversation(parent, userId)) {
        throw new ForbiddenException("You cannot access the management chat");
      }

      policyConversation = parent;
    }

    if (policyConversation.status !== ConversationStatus.Active) {
      throw new ForbiddenException("This group is not active");
    }

    if (
      policyConversation.type === ConversationType.Direct ||
      conversation.type === ConversationType.Management ||
      policyConversation.memberCanSendMessages
    ) {
      return;
    }

    const user = this.usersService.findByIdSync(userId);
    const participant = policyConversation.participants.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (
      user?.role === UserRole.Admin ||
      user?.isBot ||
      participant?.role === ParticipantRole.Owner ||
      participant?.role === ParticipantRole.Manager
    ) {
      return;
    }

    throw new ForbiddenException(
      "Only group management can send messages in this group",
    );
  }

  private hasAutomationBotParticipant(conversation: ConversationRecord) {
    return conversation.participants.some(
      (participant) =>
        !participant.leftAt &&
        Boolean(this.usersService.findByIdSync(participant.userId)?.isBot),
    );
  }

  private async buildManagementConversation(
    group: ConversationRecord,
    now: Date,
  ): Promise<ConversationRecord> {
    const participants = group.participants
      .filter((participant) =>
        this.canAccessManagementConversation(group, participant.userId),
      )
      .map((participant) => ({ ...participant }));

    return {
      id: crypto.randomUUID(),
      type: ConversationType.Management,
      name: `${group.name} - Manager Chat`,
      description: "Private conversation for group management.",
      createdBy: group.createdBy,
      externalRef: null,
      isBotManaged: group.isBotManaged,
      sourceName: group.sourceName,
      memberCanSendMessages: true,
      membersCanLeave: false,
      status: group.status,
      parentConversationId: group.id,
      participants,
      createdAt: now,
      updatedAt: now,
    };
  }

  private findManagementConversationRecord(groupId: string) {
    return Array.from(this.conversations.values()).find(
      (conversation) =>
        conversation.type === ConversationType.Management &&
        conversation.parentConversationId === groupId,
    );
  }

  private canAccessManagementConversation(
    group: ConversationRecord,
    userId: string,
  ) {
    const participant = group.participants.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (!participant) {
      return false;
    }

    const user = this.usersService.findByIdSync(userId);

    return Boolean(
      !user?.isBot &&
      (user?.role === UserRole.Admin ||
        participant.role === ParticipantRole.Owner ||
        participant.role === ParticipantRole.Manager),
    );
  }

  private async syncManagementParticipants(
    group: ConversationRecord,
    changedAt = new Date(),
  ) {
    const managementConversation = this.findManagementConversationRecord(
      group.id,
    );

    if (!managementConversation) {
      return;
    }

    const desiredParticipants = group.participants.filter(
      (participant) =>
        !participant.leftAt &&
        this.canAccessManagementConversation(group, participant.userId),
    );
    const desiredUserIds = new Set(
      desiredParticipants.map((participant) => participant.userId),
    );
    const addedUserIds: string[] = [];
    const removedUserIds: string[] = [];
    let changed = false;

    for (const participant of managementConversation.participants) {
      const desired = desiredParticipants.find(
        (item) => item.userId === participant.userId,
      );

      if (!desired && !participant.leftAt) {
        participant.leftAt = changedAt;
        removedUserIds.push(participant.userId);
        changed = true;
        continue;
      }

      if (desired) {
        if (participant.leftAt) {
          participant.leftAt = null;
          participant.joinedAt = changedAt;
          participant.lastReadAt = changedAt;
          addedUserIds.push(participant.userId);
          changed = true;
        }

        if (participant.role !== desired.role) {
          participant.role = desired.role;
          changed = true;
        }
      }
    }

    for (const desired of desiredParticipants) {
      if (
        managementConversation.participants.some(
          (participant) => participant.userId === desired.userId,
        )
      ) {
        continue;
      }

      managementConversation.participants.push({
        ...desired,
        joinedAt: changedAt,
        lastReadAt: changedAt,
        leftAt: null,
      });
      addedUserIds.push(desired.userId);
      changed = true;
    }

    if (!changed) {
      return;
    }

    managementConversation.updatedAt = changedAt;
    await this.persistConversationState(managementConversation);
    this.realtimeEventsService.emit({
      type: "conversation.updated",
      data: managementConversation,
    });

    for (const userId of addedUserIds.filter((id) => desiredUserIds.has(id))) {
      this.realtimeEventsService.emit({
        type: "participant.added",
        data: {
          conversationId: managementConversation.id,
          userId,
          joinedAt: changedAt,
        },
      });
    }

    for (const userId of removedUserIds) {
      this.realtimeEventsService.emit({
        type: "participant.removed",
        data: {
          conversationId: managementConversation.id,
          userId,
          removedAt: changedAt,
          removedBy: group.createdBy,
        },
      });
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
      replyToMessageId: null,
      content,
      messageType: MessageType.System,
      isForwarded: false,
      createdAt,
      updatedAt: null,
      deletedAt: null,
      attachments: [],
    };

    return message;
  }

  private async addInitialMessage(
    conversationId: string,
    initialMessage?: string,
    senderId?: string,
  ) {
    if (!initialMessage?.trim()) {
      return;
    }

    if (senderId) {
      await this.createMessage(conversationId, senderId, {
        content: initialMessage,
      });
      return;
    }

    await this.addSystemEvent(conversationId, initialMessage);
  }

  private findAutomationGroup(conversationId: string, botUserId: string) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    this.ensureGroupConversation(conversation);

    if (
      !conversation.isBotManaged ||
      !this.isParticipant(conversation, botUserId)
    ) {
      throw new ForbiddenException("Group is not managed by the bot");
    }

    return conversation;
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
        description: conversation.description,
        createdBy: conversation.createdBy,
        externalRef: conversation.externalRef ?? null,
        isBotManaged: conversation.isBotManaged,
        sourceName: conversation.sourceName,
        memberCanSendMessages: conversation.memberCanSendMessages,
        membersCanLeave: conversation.membersCanLeave,
        status: conversation.status as unknown as PrismaConversationStatus,
        parentConversationId: conversation.parentConversationId,
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
                  replyToMessageId: message.replyToMessageId,
                  content: message.content,
                  messageType:
                    message.messageType as unknown as PrismaMessageType,
                  isForwarded: message.isForwarded,
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
          description: conversation.description,
          externalRef: conversation.externalRef ?? null,
          isBotManaged: conversation.isBotManaged,
          sourceName: conversation.sourceName,
          memberCanSendMessages: conversation.memberCanSendMessages,
          membersCanLeave: conversation.membersCanLeave,
          status: conversation.status as unknown as PrismaConversationStatus,
          parentConversationId: conversation.parentConversationId,
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

  private async persistMessageWithAttachments(
    conversation: ConversationRecord,
    message: MessageRecord,
    files: UploadedMessageFile[],
  ) {
    if (!this.prismaService?.enabled) {
      return;
    }

    await this.prismaService.client.$transaction(async (transaction) => {
      await transaction.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: conversation.updatedAt },
      });
      await transaction.message.create({
        data: {
          ...this.toPersistedMessage(message),
          attachments: {
            create: (message.attachments ?? []).map((attachment, index) => ({
              id: attachment.id,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              fileSize: attachment.fileSize,
              data: Uint8Array.from(files[index].buffer),
              createdAt: attachment.createdAt,
            })),
          },
        },
      });
    });
  }

  private async persistMessageUpdate(
    message: MessageRecord,
    conversationUpdatedAt: Date,
  ) {
    if (!this.prismaService?.enabled) {
      return;
    }

    await this.prismaService.client.$transaction(async (transaction) => {
      await transaction.message.update({
        where: { id: message.id },
        data: {
          content: message.content,
          updatedAt: message.updatedAt,
          deletedAt: message.deletedAt,
        },
      });
      await transaction.conversation.update({
        where: { id: message.conversationId },
        data: { updatedAt: conversationUpdatedAt },
      });

      if (message.deletedAt) {
        await transaction.messageAttachment.deleteMany({
          where: { messageId: message.id },
        });
      }
    });
  }

  private toPersistedMessage(message: MessageRecord) {
    return {
      id: message.id,
      clientMessageId: message.clientMessageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      replyToMessageId: message.replyToMessageId,
      content: message.content,
      messageType: message.messageType as unknown as PrismaMessageType,
      isForwarded: message.isForwarded,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      deletedAt: message.deletedAt,
    };
  }

  private validateAttachmentFiles(files: UploadedMessageFile[]) {
    if (files.length === 0) {
      throw new BadRequestException("At least one attachment is required");
    }

    if (files.length > MAX_MESSAGE_ATTACHMENTS) {
      throw new BadRequestException(
        `A message can contain at most ${MAX_MESSAGE_ATTACHMENTS} attachments`,
      );
    }

    for (const file of files) {
      if (!ALLOWED_MESSAGE_ATTACHMENT_TYPES.has(file.mimetype.toLowerCase())) {
        throw new BadRequestException(
          `Unsupported attachment type: ${file.mimetype || "unknown"}`,
        );
      }

      if (file.size <= 0 || file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
        throw new BadRequestException(
          `Each attachment must be between 1 byte and ${MAX_MESSAGE_ATTACHMENT_BYTES} bytes`,
        );
      }

      if (!this.hasValidAttachmentSignature(file)) {
        throw new BadRequestException(
          `Attachment content does not match its declared type: ${file.originalname}`,
        );
      }
    }
  }

  private hasValidAttachmentSignature(file: UploadedMessageFile) {
    const mimeType = file.mimetype.toLowerCase();
    const data = file.buffer;

    switch (mimeType) {
      case "image/jpeg":
        return (
          data.length >= 3 &&
          data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        );
      case "image/png":
        return (
          data.length >= 8 &&
          data
            .subarray(0, 8)
            .equals(
              Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            )
        );
      case "image/gif": {
        const signature = data.subarray(0, 6).toString("ascii");
        return signature === "GIF87a" || signature === "GIF89a";
      }
      case "image/webp":
        return (
          data.length >= 12 &&
          data.subarray(0, 4).toString("ascii") === "RIFF" &&
          data.subarray(8, 12).toString("ascii") === "WEBP"
        );
      case "application/pdf":
        return (
          data.length >= 5 && data.subarray(0, 5).toString("ascii") === "%PDF-"
        );
      case "text/plain":
        return !data.includes(0);
      case "audio/mpeg":
        return (
          data.subarray(0, 3).toString("ascii") === "ID3" ||
          (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
        );
      case "audio/wav":
        return (
          data.length >= 12 &&
          data.subarray(0, 4).toString("ascii") === "RIFF" &&
          data.subarray(8, 12).toString("ascii") === "WAVE"
        );
      case "audio/ogg":
        return data.subarray(0, 4).toString("ascii") === "OggS";
      case "audio/webm":
        return (
          data.length >= 4 &&
          data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
        );
      case "audio/mp4":
        return (
          data.length >= 12 && data.subarray(4, 8).toString("ascii") === "ftyp"
        );
      default:
        return false;
    }
  }

  private normalizeAttachmentFileName(value: string) {
    const normalized = value
      .replace(/[\\/]/g, "_")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 255);

    return normalized || "attachment";
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

  private validateReplyTarget(
    conversationId: string,
    replyToMessageId?: string,
  ) {
    if (!replyToMessageId) {
      return;
    }

    const replyTo = this.findMessageOrThrow(conversationId, replyToMessageId);

    if (replyTo.deletedAt) {
      throw new BadRequestException("Cannot reply to a deleted message");
    }
  }

  private withReplyReference(message: MessageRecord) {
    const replyTo = message.replyToMessageId
      ? (this.messages.get(message.conversationId) ?? []).find(
          (candidate) => candidate.id === message.replyToMessageId,
        )
      : null;

    return {
      ...message,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            conversationId: replyTo.conversationId,
            senderId: replyTo.senderId,
            content: replyTo.content,
            messageType: replyTo.messageType,
            isForwarded: replyTo.isForwarded,
            createdAt: replyTo.createdAt,
            deletedAt: replyTo.deletedAt,
            attachments: replyTo.attachments ?? [],
          }
        : null,
    };
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

  private conversationPreferenceKey(userId: string, conversationId: string) {
    return `${userId}:${conversationId}`;
  }

  private getConversationPreference(
    conversationId: string,
    userId: string,
  ): ConversationPreferenceRecord {
    return (
      this.conversationPreferences.get(
        this.conversationPreferenceKey(userId, conversationId),
      ) ?? {
        userId,
        conversationId,
        isBookmarked: false,
        isArchived: false,
        isDeleted: false,
      }
    );
  }

  private withConversationPreference(
    conversation: ConversationRecord,
    userId: string,
  ) {
    const preference = this.getConversationPreference(conversation.id, userId);

    return {
      ...conversation,
      isBookmarked: preference.isBookmarked,
      isArchived: preference.isArchived,
    };
  }

  private async setConversationPreference(
    conversationId: string,
    userId: string,
    updates: ConversationPreferenceUpdates,
  ) {
    const current = this.getConversationPreference(conversationId, userId);
    const preference = {
      ...current,
      ...updates,
    };

    if (
      this.prismaService?.enabled &&
      this.prismaService.client.conversationPreference
    ) {
      await this.prismaService.client.conversationPreference.upsert({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
        create: preference,
        update: updates,
      });
    }

    this.conversationPreferences.set(
      this.conversationPreferenceKey(userId, conversationId),
      preference,
    );

    return preference;
  }

  private async restoreDeletedConversationForParticipants(
    conversation: ConversationRecord,
  ) {
    const deletedParticipants = conversation.participants.filter(
      (participant) =>
        !participant.leftAt &&
        this.getConversationPreference(conversation.id, participant.userId)
          .isDeleted,
    );

    await Promise.all(
      deletedParticipants.map((participant) =>
        this.setConversationPreference(conversation.id, participant.userId, {
          isDeleted: false,
        }),
      ),
    );
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
      if (message.deletedAt || message.senderId === userId) {
        return false;
      }

      if (!lastReadAt) {
        return true;
      }

      return message.createdAt > lastReadAt;
    }).length;

    return {
      ...this.withConversationPreference(conversation, userId),
      participantCount: conversation.participants.filter((item) => !item.leftAt)
        .length,
      lastMessage,
      unreadCount,
    };
  }
}
