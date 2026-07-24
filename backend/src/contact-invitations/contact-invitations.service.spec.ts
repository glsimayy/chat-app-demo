import { ConflictException } from "@nestjs/common";
import { ContactInvitationStatus } from "./contact-invitation-status.enum";
import { ContactInvitationsService } from "./contact-invitations.service";

describe("ContactInvitationsService", () => {
  const sender = {
    id: "11111111-1111-4111-8111-111111111111",
    username: "sender",
    email: "sender@ello.local",
    role: "user",
    createdAt: new Date(),
    isBot: false,
  };
  const recipient = {
    id: "22222222-2222-4222-8222-222222222222",
    username: "recipient",
    email: "recipient@ello.local",
    role: "user",
    createdAt: new Date(),
    isBot: false,
  };

  const createService = (hasDirectConversation = false) => {
    const users = {
      findById: jest.fn(async (id: string) =>
        id === sender.id ? sender : id === recipient.id ? recipient : undefined,
      ),
      findByEmail: jest.fn(async (email: string) =>
        email === recipient.email ? recipient : undefined,
      ),
      findByIdSync: jest.fn((id: string) =>
        id === sender.id ? sender : id === recipient.id ? recipient : undefined,
      ),
    };
    const conversations = {
      hasDirectConversation: jest.fn(() => hasDirectConversation),
      createDirectConversation: jest.fn(async () => ({ id: "conversation-1" })),
    };
    const realtime = { emit: jest.fn() };
    const service = new ContactInvitationsService(
      users as any,
      conversations as any,
      realtime as any,
    );

    return { conversations, realtime, service };
  };

  it("delivers a pending invitation to the recipient", async () => {
    const { realtime, service } = createService();
    const invitation = await service.create(sender.id, {
      email: recipient.email,
      message: "Hello",
    });

    expect(service.findReceived(recipient.id)).toEqual([invitation]);
    expect(realtime.emit).toHaveBeenCalledWith({
      type: "contact.invitation.created",
      data: invitation,
    });
  });

  it("accepts an invitation and creates the direct conversation", async () => {
    const { conversations, service } = createService();
    const invitation = await service.create(sender.id, {
      email: recipient.email,
    });
    const result = await service.respond(invitation.id, recipient.id, {
      status: ContactInvitationStatus.Accepted,
    });

    expect(conversations.createDirectConversation).toHaveBeenCalledWith(
      recipient.id,
      { participantId: sender.id },
    );
    expect(result.conversationId).toBe("conversation-1");
    expect(service.findReceived(recipient.id)).toEqual([]);
  });

  it("rejects duplicate pending invitations", async () => {
    const { service } = createService();
    await service.create(sender.id, { email: recipient.email });

    await expect(
      service.create(sender.id, { email: recipient.email }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects an invitation when the users already have a direct contact", async () => {
    const { realtime, service } = createService(true);

    await expect(
      service.create(sender.id, { email: recipient.email }),
    ).rejects.toThrow("Users are already contacts");
    expect(realtime.emit).not.toHaveBeenCalled();
  });
});
