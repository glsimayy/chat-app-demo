import { NotFoundException } from "@nestjs/common";
import { ConversationType } from "../conversations/conversation-type.enum";
import { MessageType } from "../conversations/message-type.enum";
import { BookmarksService } from "./bookmarks.service";

describe("BookmarksService", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const otherUserId = "22222222-2222-4222-8222-222222222222";
  const messageId = "33333333-3333-4333-8333-333333333333";
  const conversation = {
    id: "44444444-4444-4444-8444-444444444444",
    type: ConversationType.Direct,
    name: null,
    parentConversationId: null,
    participants: [
      {
        userId,
        leftAt: null,
      },
      {
        userId: otherUserId,
        leftAt: null,
      },
    ],
  };
  const message = {
    id: messageId,
    clientMessageId: null,
    conversationId: conversation.id,
    senderId: otherUserId,
    content: "Important release detail",
    messageType: MessageType.User,
    createdAt: new Date("2026-07-23T10:00:00.000Z"),
    updatedAt: null,
    deletedAt: null,
    attachments: [],
  };
  const sender = {
    id: otherUserId,
    automationId: null,
    username: "sender",
    email: "sender@ello.local",
    role: "user",
    about: null,
    location: null,
    profileImage: null,
    createdAt: new Date(),
    isBot: false,
  };

  const createService = () => {
    const conversations = {
      findMessageForUser: jest.fn(
        async (requestedId: string, ownerId: string) => {
          if (requestedId !== messageId || ownerId !== userId) {
            throw new NotFoundException("Message not found");
          }
          return { conversation, message };
        },
      ),
    };
    const users = {
      findByIdSync: jest.fn(() => sender),
    };
    const service = new BookmarksService(conversations as any, users as any);

    return { conversations, service };
  };

  it("creates one user-specific bookmark idempotently", async () => {
    const { service } = createService();
    const first = await service.create(userId, { messageId });
    const second = await service.create(userId, { messageId });

    expect(first.message.content).toBe("Important release detail");
    expect(first.conversation.name).toBe("sender");
    expect(second.id).toBe(first.id);
    await expect(service.findAll(userId)).resolves.toHaveLength(1);
  });

  it("updates the title and removes the bookmark", async () => {
    const { service } = createService();
    await service.create(userId, { messageId });
    const updated = await service.update(userId, messageId, {
      title: "Release note",
    });

    expect(updated.title).toBe("Release note");
    await expect(service.remove(userId, messageId)).resolves.toEqual({
      messageId,
      removed: true,
    });
    await expect(service.findAll(userId)).resolves.toEqual([]);
  });

  it("does not expose another user's bookmark", async () => {
    const { service } = createService();
    await service.create(userId, { messageId });

    await expect(service.findAll(otherUserId)).resolves.toEqual([]);
    await expect(service.remove(otherUserId, messageId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
