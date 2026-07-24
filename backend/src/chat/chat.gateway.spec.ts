import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import { CallsService } from "../calls/calls.service";
import { ConversationType } from "../conversations/conversation-type.enum";
import { ConversationsService } from "../conversations/conversations.service";
import { ParticipantRole } from "../conversations/participant-role.enum";
import { RealtimeEventsService } from "../conversations/realtime-events.service";
import { MetricsService } from "../metrics/metrics.service";
import { UserRole } from "../users/user-role.enum";
import { UsersService } from "../users/users.service";
import { ChatGateway } from "./chat.gateway";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";

describe("ChatGateway audio calls", () => {
  const callerId = "00000000-0000-4000-8000-000000000001";
  const recipientId = "00000000-0000-4000-8000-000000000002";
  const conversationId = "00000000-0000-4000-8000-000000000100";
  const now = new Date();
  const directConversation = {
    id: conversationId,
    type: ConversationType.Direct,
    participants: [
      {
        userId: callerId,
        role: ParticipantRole.Owner,
        joinedAt: now,
        lastReadAt: now,
        leftAt: null,
      },
      {
        userId: recipientId,
        role: ParticipantRole.Member,
        joinedAt: now,
        lastReadAt: now,
        leftAt: null,
      },
    ],
  };
  const conversationsService = {
    findOneForUser: jest.fn(),
  };
  const usersService = {
    findById: jest.fn((userId: string) =>
      Promise.resolve({
        id: userId,
        username: userId === callerId ? "caller" : "recipient",
        profileImage: null,
        isBot: false,
      }),
    ),
  };
  const socketRateLimiter = {
    consume: jest.fn(),
    clear: jest.fn(),
  };
  const metrics = {
    recordSocketEvent: jest.fn(),
    recordSocketConnection: jest.fn(),
    recordSocketDisconnect: jest.fn(),
    recordSocketError: jest.fn(),
  };
  const realtimeEvents = {
    onEvent: jest.fn(() => jest.fn()),
  };
  const callsService = {
    start: jest.fn(),
    accept: jest.fn(),
    finish: jest.fn(),
  };
  const server = {
    to: jest.fn(),
    emit: jest.fn(),
  };
  let gateway: ChatGateway;

  const clientFor = (userId: string, socketId: string) => {
    const client = {
      id: socketId,
      data: {
        user: {
          id: userId,
          email: `${userId}@ello.test`,
          role: UserRole.User,
        },
        conversationIds: new Set<string>(),
      },
      to: jest.fn(),
      emit: jest.fn(),
    } as any;
    client.to.mockReturnValue(client);
    return client;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    conversationsService.findOneForUser.mockResolvedValue(directConversation);
    usersService.findById.mockImplementation((userId: string) =>
      Promise.resolve({
        id: userId,
        username: userId === callerId ? "caller" : "recipient",
        profileImage: null,
        isBot: false,
      }),
    );
    server.to.mockReturnValue(server);

    gateway = new ChatGateway(
      conversationsService as unknown as ConversationsService,
      {} as JwtService,
      {} as ConfigService,
      realtimeEvents as unknown as RealtimeEventsService,
      socketRateLimiter as unknown as SocketRateLimiterService,
      metrics as unknown as MetricsService,
      usersService as unknown as UsersService,
      callsService as unknown as CallsService,
    );
    (gateway as any).server = server;
    (gateway as any).onlineUserSockets.set(
      callerId,
      new Set(["caller-socket"]),
    );
    (gateway as any).onlineUserSockets.set(
      recipientId,
      new Set(["recipient-socket"]),
    );
  });

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  it("rings an online participant in an authorized direct conversation", async () => {
    const ack = jest.fn();

    const response = await gateway.startCall(
      clientFor(callerId, "caller-socket"),
      { conversationId, targetUserId: recipientId },
      ack,
    );

    expect(response).toMatchObject({
      success: true,
      data: {
        conversationId,
        callerId,
        recipientId,
        status: "ringing",
      },
    });
    expect(ack).toHaveBeenCalledWith(response);
    expect(server.to).toHaveBeenCalledWith(`user:${recipientId}`);
    expect(server.emit).toHaveBeenCalledWith(
      "call:incoming",
      expect.objectContaining({
        caller: expect.objectContaining({ id: callerId, username: "caller" }),
      }),
    );
  });

  it("rejects audio calls for group conversations", async () => {
    conversationsService.findOneForUser.mockResolvedValue({
      ...directConversation,
      type: ConversationType.Group,
    });

    await expect(
      gateway.startCall(clientFor(callerId, "caller-socket"), {
        conversationId,
        targetUserId: recipientId,
      }),
    ).rejects.toMatchObject({
      error: expect.objectContaining({ code: "DIRECT_CALLS_ONLY" }),
    });
  });

  it("rejects calls to automation bots", async () => {
    usersService.findById.mockImplementation((userId: string) =>
      Promise.resolve({
        id: userId,
        username: userId === callerId ? "caller" : "bot",
        profileImage: null,
        isBot: userId === recipientId,
      }),
    );

    await expect(
      gateway.startCall(clientFor(callerId, "caller-socket"), {
        conversationId,
        targetUserId: recipientId,
      }),
    ).rejects.toBeInstanceOf(WsException);
  });

  it("forwards SDP only after the recipient accepts the call", async () => {
    const started = (await gateway.startCall(
      clientFor(callerId, "caller-socket"),
      { conversationId, targetUserId: recipientId },
    )) as any;
    const callId = started.data.callId;
    server.emit.mockClear();

    await gateway.acceptCall(clientFor(recipientId, "recipient-socket"), {
      callId,
    });
    const response = gateway.signalCall(clientFor(callerId, "caller-socket"), {
      callId,
      signalType: "offer",
      sdp: "v=0\r\nmock-offer",
    });

    expect(response).toEqual({
      success: true,
      data: { callId, signalType: "offer" },
    });
    expect(server.to).toHaveBeenLastCalledWith(`user:${recipientId}`);
    expect(server.emit).toHaveBeenLastCalledWith(
      "call:signal",
      expect.objectContaining({
        callId,
        fromUserId: callerId,
        signalType: "offer",
      }),
    );
  });
});
