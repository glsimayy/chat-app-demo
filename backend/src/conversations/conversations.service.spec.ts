import { ConversationsService } from "./conversations.service";

describe("ConversationsService contacts", () => {
  const userA = {
    id: "11111111-1111-4111-8111-111111111111",
    automationId: 1,
    username: "alpha",
    email: "alpha@ello.local",
    role: "user",
    about: null,
    location: null,
    profileImage: null,
    createdAt: new Date(),
    isBot: false,
  };
  const userB = {
    id: "22222222-2222-4222-8222-222222222222",
    automationId: 2,
    username: "beta",
    email: "beta@ello.local",
    role: "user",
    about: null,
    location: null,
    profileImage: null,
    createdAt: new Date(),
    isBot: false,
  };

  const createService = () => {
    const usersById = new Map([
      [userA.id, userA],
      [userB.id, userB],
    ]);
    const users = {
      findById: jest.fn(async (id: string) => usersById.get(id)),
      findByIdSync: jest.fn((id: string) => usersById.get(id)),
    };
    const realtime = { emit: jest.fn() };
    const metrics = {};
    const service = new ConversationsService(
      users as any,
      realtime as any,
      metrics as any,
    );

    return { realtime, service };
  };

  it("derives one contact from an idempotent direct conversation", async () => {
    const { realtime, service } = createService();
    const first = await service.createDirectConversation(userA.id, {
      participantId: userB.id,
    });
    const second = await service.createDirectConversation(userA.id, {
      participantId: userB.id,
    });

    expect(second.id).toBe(first.id);
    expect(service.findContactsForUser(userA.id)).toEqual([userB]);
    expect(service.findContactsForUser(userB.id)).toEqual([userA]);
    expect(realtime.emit).toHaveBeenCalledTimes(1);
  });

  it("keeps the contact available when one user hides the direct chat", async () => {
    const { service } = createService();
    const conversation = await service.createDirectConversation(userA.id, {
      participantId: userB.id,
    });

    await service.deleteConversationForUser(conversation.id, userA.id);

    expect(service.findContactsForUser(userA.id)).toEqual([userB]);
  });
});
