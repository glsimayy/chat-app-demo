import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { UserRole } from "../users/user-role.enum";
import { ConversationType } from "./conversation-type.enum";
import { ConversationRecord, MessageRecord } from "./conversation.types";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto";
import { CreateGroupConversationDto } from "./dto/create-group-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { FindMessagesQueryDto } from "./dto/find-messages-query.dto";
import { MessageType } from "./message-type.enum";
import { ParticipantRole } from "./participant-role.enum";

@Injectable()
export class ConversationsService {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly messages = new Map<string, MessageRecord[]>();

  constructor(private readonly usersService: UsersService) {}

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

    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);

    return conversation;
  }

  async createGroupConversation(
    currentUserId: string,
    dto: CreateGroupConversationDto,
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
      externalRef: null,
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

    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    this.addSystemMessage(
      conversation.id,
      `Group "${conversation.name}" was created.`,
      now,
    );

    return conversation;
  }

  addSystemEvent(conversationId: string, content: string) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const now = new Date();
    this.addSystemMessage(conversationId, content.trim(), now);
    conversation.updatedAt = now;
  }

  async findForUser(userId: string) {
    return Array.from(this.conversations.values())
      .filter((conversation) => this.isParticipant(conversation, userId))
      .map((conversation) => this.toConversationSummary(conversation, userId))
      .sort((left, right) => {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      });
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

    const message: MessageRecord = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: userId,
      content,
      messageType: MessageType.User,
      createdAt: new Date(),
    };

    this.messages.get(conversation.id)?.push(message);
    conversation.updatedAt = message.createdAt;

    return message;
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

    return {
      conversationId,
      readAt,
      unreadCount: 0,
    };
  }

  async findParticipants(conversationId: string, userId: string) {
    const conversation = await this.findOneForUser(conversationId, userId);
    return conversation.participants.filter(
      (participant) => !participant.leftAt,
    );
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
    this.addSystemMessage(
      conversation.id,
      `${user.username} joined the group.`,
      now,
    );

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
    this.addSystemMessage(
      conversation.id,
      `${user?.username ?? "A user"} left the group.`,
      now,
    );

    return conversation.participants.filter((item) => !item.leftAt);
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

  private addSystemMessage(
    conversationId: string,
    content: string,
    createdAt = new Date(),
  ) {
    const message: MessageRecord = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: null,
      content,
      messageType: MessageType.System,
      createdAt,
    };

    this.messages.get(conversationId)?.push(message);
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
