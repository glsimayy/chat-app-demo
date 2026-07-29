import { ConversationsService } from "./conversations.service";
import { CatchUpWindow } from "./catch-up-window.enum";

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
    const metrics = { recordMessageCreated: jest.fn() };
    const service = new ConversationsService(
      users as any,
      realtime as any,
      metrics as any,
    );

    return { metrics, realtime, service };
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

  it("marks concurrent external group retries as reused", async () => {
    const { metrics, realtime, service } = createService();
    const payload = {
      name: "External incident",
      participantIds: [userA.id, userB.id],
      managerIds: [],
      memberCanSendMessages: false,
      membersCanLeave: false,
    };

    const firstRequest = service.createExternalGroupConversation(
      userA.id,
      payload,
      "incident-42",
    );
    const concurrentRetry = service.createExternalGroupConversation(
      userA.id,
      payload,
      "incident-42",
    );
    const [created, reused] = await Promise.all([
      firstRequest,
      concurrentRetry,
    ]);
    const laterRetry = await service.createExternalGroupConversation(
      userA.id,
      { ...payload, name: "Different incident name" },
      "incident-42",
    );

    expect(created).toMatchObject({ created: true, reused: false });
    expect(reused).toMatchObject({
      id: created.id,
      created: false,
      reused: true,
    });
    expect(laterRetry).toMatchObject({
      id: created.id,
      name: payload.name,
      created: false,
      reused: true,
    });
    expect(metrics.recordMessageCreated).toHaveBeenCalledTimes(1);
    expect(realtime.emit).toHaveBeenCalledTimes(3);
  });

  it("builds a deterministic catch-up for authorized participants", async () => {
    const { service } = createService();
    const conversation = await service.createDirectConversation(userA.id, {
      participantId: userB.id,
    });
    const decision = await service.createMessage(conversation.id, userA.id, {
      content: "Karar: Docker deployment bugün onaylandı.",
    });
    await service.createMessage(conversation.id, userB.id, {
      content: "TODO: deployment testlerini teslim etmemiz gerekiyor.",
      replyToMessageId: decision.id,
    });

    const catchUp = await service.catchUpMessages(conversation.id, userA.id, {
      window: CatchUpWindow.TwoHours,
    });

    expect(catchUp).toMatchObject({
      conversationId: conversation.id,
      window: CatchUpWindow.TwoHours,
      messageCount: 2,
      participantCount: 2,
      replyCount: 1,
      truncated: false,
    });
    expect(catchUp.summary).toContain("2 messages were posted");
    expect(catchUp.activeParticipants.map((user) => user.username)).toEqual(
      expect.arrayContaining(["alpha", "beta"]),
    );
    expect(catchUp.topics.map((topic) => topic.label)).toContain("deployment");
    expect(catchUp.keyMoments.map((moment) => moment.kind)).toEqual(
      expect.arrayContaining(["decision", "action"]),
    );

    await expect(
      service.catchUpMessages(
        conversation.id,
        "33333333-3333-4333-8333-333333333333",
      ),
    ).rejects.toThrow("Conversation not found");
  });
});
