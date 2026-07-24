import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ConversationsService } from "../conversations/conversations.service";
import { UsersService } from "../users/users.service";
import { MessageBookmarkRecord, MessageBookmarkView } from "./bookmark.types";
import { CreateMessageBookmarkDto } from "./dto/create-message-bookmark.dto";
import { UpdateMessageBookmarkDto } from "./dto/update-message-bookmark.dto";

@Injectable()
export class BookmarksService implements OnModuleInit {
  private readonly bookmarks = new Map<string, MessageBookmarkRecord>();

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const persisted =
      await this.prismaService.client.messageBookmark.findMany();

    for (const bookmark of persisted) {
      this.bookmarks.set(
        this.bookmarkKey(bookmark.userId, bookmark.messageId),
        bookmark,
      );
    }
  }

  async findAll(userId: string) {
    const records = Array.from(this.bookmarks.values())
      .filter((bookmark) => bookmark.userId === userId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    const views: MessageBookmarkView[] = [];

    for (const record of records) {
      try {
        views.push(await this.toView(record));
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    return views;
  }

  async create(userId: string, dto: CreateMessageBookmarkDto) {
    await this.conversationsService.findMessageForUser(dto.messageId, userId);
    const key = this.bookmarkKey(userId, dto.messageId);
    const existing = this.bookmarks.get(key);

    if (existing) {
      return this.toView(existing);
    }

    const now = new Date();
    const bookmark: MessageBookmarkRecord = {
      userId,
      messageId: dto.messageId,
      title: this.normalizeTitle(dto.title),
      createdAt: now,
      updatedAt: now,
    };

    if (this.prismaService?.enabled) {
      await this.prismaService.client.messageBookmark.create({
        data: bookmark,
      });
    }

    this.bookmarks.set(key, bookmark);
    return this.toView(bookmark);
  }

  async update(
    userId: string,
    messageId: string,
    dto: UpdateMessageBookmarkDto,
  ) {
    const key = this.bookmarkKey(userId, messageId);
    const bookmark = this.bookmarks.get(key);

    if (!bookmark) {
      throw new NotFoundException("Bookmark not found");
    }

    bookmark.title = this.normalizeTitle(dto.title);
    bookmark.updatedAt = new Date();

    if (this.prismaService?.enabled) {
      await this.prismaService.client.messageBookmark.update({
        where: { userId_messageId: { userId, messageId } },
        data: {
          title: bookmark.title,
          updatedAt: bookmark.updatedAt,
        },
      });
    }

    return this.toView(bookmark);
  }

  async remove(userId: string, messageId: string) {
    const key = this.bookmarkKey(userId, messageId);

    if (!this.bookmarks.has(key)) {
      throw new NotFoundException("Bookmark not found");
    }

    if (this.prismaService?.enabled) {
      await this.prismaService.client.messageBookmark.delete({
        where: { userId_messageId: { userId, messageId } },
      });
    }

    this.bookmarks.delete(key);
    return { messageId, removed: true };
  }

  async clearAll() {
    const deletedBookmarks = this.bookmarks.size;

    if (this.prismaService?.enabled) {
      await this.prismaService.client.messageBookmark.deleteMany();
    }

    this.bookmarks.clear();
    return { deletedBookmarks };
  }

  private async toView(
    bookmark: MessageBookmarkRecord,
  ): Promise<MessageBookmarkView> {
    const { conversation, message } =
      await this.conversationsService.findMessageForUser(
        bookmark.messageId,
        bookmark.userId,
      );
    const sender = message.senderId
      ? (this.usersService.findByIdSync(message.senderId) ?? null)
      : null;
    const directParticipant =
      conversation.type === "direct"
        ? conversation.participants?.find(
            (participant) =>
              participant.userId !== bookmark.userId && !participant.leftAt,
          )
        : null;
    const conversationName = directParticipant
      ? (this.usersService.findByIdSync(directParticipant.userId)?.username ??
        conversation.name)
      : conversation.name;

    return {
      ...bookmark,
      id: bookmark.messageId,
      message,
      conversation: {
        id: conversation.id,
        name: conversationName,
        type: conversation.type,
        parentConversationId: conversation.parentConversationId,
      },
      sender,
    };
  }

  private bookmarkKey(userId: string, messageId: string) {
    return `${userId}:${messageId}`;
  }

  private normalizeTitle(value?: string) {
    return value?.trim() || null;
  }
}
