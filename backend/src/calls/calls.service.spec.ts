import { CallsService } from "./calls.service";

describe("CallsService", () => {
  const callerId = "00000000-0000-4000-8000-000000000001";
  const recipientId = "00000000-0000-4000-8000-000000000002";
  const conversationId = "00000000-0000-4000-8000-000000000100";
  const usersService = {
    findByIdSync: jest.fn((id: string) => ({
      id,
      username: id === callerId ? "caller" : "recipient",
      profileImage: null,
    })),
  };

  const createService = () => new CallsService(usersService as any);

  it("returns a completed call to both participants with direction", async () => {
    const service = createService();
    await service.start({
      id: "00000000-0000-4000-8000-000000000200",
      conversationId,
      callerId,
      recipientId,
      startedAt: new Date("2026-07-24T12:00:00.000Z"),
    });
    await service.accept("00000000-0000-4000-8000-000000000200");
    await service.finish(
      "00000000-0000-4000-8000-000000000200",
      "ended",
      callerId,
    );

    expect(service.findForUser(callerId)[0]).toMatchObject({
      direction: "outgoing",
      status: "completed",
      peer: { id: recipientId, username: "recipient" },
    });
    expect(service.findForUser(recipientId)[0]).toMatchObject({
      direction: "incoming",
      status: "completed",
      peer: { id: callerId, username: "caller" },
    });
  });

  it("classifies unanswered ringing calls as missed", async () => {
    const service = createService();
    const callId = "00000000-0000-4000-8000-000000000201";
    await service.start({
      id: callId,
      conversationId,
      callerId,
      recipientId,
      startedAt: new Date(),
    });
    await service.finish(callId, "unanswered");

    expect(service.findForUser(recipientId)[0]).toMatchObject({
      status: "missed",
      durationSeconds: 0,
    });
  });
});
