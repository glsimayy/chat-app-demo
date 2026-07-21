import {
  isBotDirectConversation,
  mapConversationToListItem,
  mapMessage,
} from "./backendAdapters";

describe("backend adapters for automation", () => {
  beforeEach(() => {
    localStorage.setItem("authUser", JSON.stringify({ id: "current-user" }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("marks groups with an external reference as automated", () => {
    const channel = mapConversationToListItem({
      id: "conversation-1",
      type: "group",
      name: "Support TICKET-42",
      externalRef: "ticket-42",
      participants: [],
    });

    expect(channel).toMatchObject({
      automated: true,
      externalRef: "ticket-42",
    });
  });

  it("attaches the automation bot identity to bot messages", () => {
    const message = mapMessage(
      {
        id: "message-1",
        conversationId: "conversation-1",
        senderId: "bot-user",
        content: "Ticket received.",
        messageType: "user",
        createdAt: "2026-07-20T10:00:00.000Z",
      },
      [
        {
          id: "bot-user",
          username: "ellO Automation Bot",
          email: "automation.bot@ello.local",
          isBot: true,
        },
      ],
    );

    expect(message.meta.userData).toMatchObject({
      username: "ellO Automation Bot",
      isBot: true,
    });
    expect(message.meta.sent).toBe(false);
  });

  it("identifies direct conversations containing an automation bot", () => {
    const conversation = {
      id: "bot-direct",
      type: "direct",
      participants: [
        { userId: "current-user", leftAt: null },
        { userId: "bot-user", leftAt: null },
      ],
    };

    expect(
      isBotDirectConversation(conversation, [
        { id: "current-user", isBot: false },
        { id: "bot-user", isBot: true },
      ]),
    ).toBe(true);
  });
});
