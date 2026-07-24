import {
  OnModuleDestroy,
  OnModuleInit,
  Logger,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CallsService } from "../calls/calls.service";
import { ConversationType } from "../conversations/conversation-type.enum";
import { ConversationsService } from "../conversations/conversations.service";
import { MetricsService } from "../metrics/metrics.service";
import { CreateMessageDto } from "../conversations/dto/create-message.dto";
import { TransferGroupOwnerDto } from "../conversations/dto/transfer-group-owner.dto";
import { UpdateGroupConversationDto } from "../conversations/dto/update-group-conversation.dto";
import { UpdateMessageDto } from "../conversations/dto/update-message.dto";
import {
  ConversationRealtimeEvent,
  RealtimeEventsService,
} from "../conversations/realtime-events.service";
import {
  CallEventPayloadDto,
  CallSignalPayloadDto,
  ConversationEventPayloadDto,
  DeleteMessagePayloadDto,
  RejectCallPayloadDto,
  SendMessagePayloadDto,
  StartCallPayloadDto,
  SyncConversationsPayloadDto,
  TransferOwnerPayloadDto,
  UpdateConversationPayloadDto,
  UpdateMessagePayloadDto,
} from "./dto/socket-event.dto";
import { SocketExceptionFilter } from "./socket-exception.filter";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { UsersService } from "../users/users.service";

interface AuthenticatedSocket extends Socket {
  data: {
    conversationIds?: Set<string>;
    user?: AuthenticatedUser;
  };
}

interface JwtPayload {
  sub: string;
  email: string;
  role: AuthenticatedUser["role"];
}

type CallStatus = "ringing" | "active";

interface CallSession {
  id: string;
  conversationId: string;
  callerId: string;
  recipientId: string;
  status: CallStatus;
  createdAt: Date;
}

@WebSocketGateway({
  namespace: "chat",
})
@UseFilters(SocketExceptionFilter)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new WsException({
        code: "VALIDATION_ERROR",
        message: "Invalid socket payload",
        errors: errors.map((error) => ({
          property: error.property,
          messages: Object.values(error.constraints ?? {}),
        })),
      }),
  }),
)
export class ChatGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly onlineUserSockets = new Map<string, Set<string>>();
  private readonly authenticatedSockets = new Map<
    string,
    AuthenticatedSocket
  >();
  private readonly logger = new Logger(ChatGateway.name);
  private readonly callSessions = new Map<string, CallSession>();
  private readonly callTimeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly callRingTimeoutMs = 30_000;
  private removeRealtimeListener?: () => void;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly socketRateLimiterService: SocketRateLimiterService,
    private readonly metricsService: MetricsService,
    private readonly usersService: UsersService,
    private readonly callsService: CallsService,
  ) {}

  onModuleInit() {
    this.removeRealtimeListener = this.realtimeEventsService.onEvent((event) =>
      this.broadcastRealtimeEvent(event),
    );
  }

  onModuleDestroy() {
    this.removeRealtimeListener?.();
    for (const timeout of this.callTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.callTimeouts.clear();
    this.callSessions.clear();
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_SECRET", "dev-secret"),
      });

      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      client.data.conversationIds = new Set<string>();

      this.trackOnlineSocket(payload.sub, client.id);
      this.authenticatedSockets.set(client.id, client);
      this.metricsService.recordSocketConnection();
      this.logger.log(
        JSON.stringify({
          type: "socket_connected",
          socketId: client.id,
          userId: payload.sub,
        }),
      );
      await client.join(this.userRoom(payload.sub));
      client.emit("session:ready", {
        userId: payload.sub,
        conversationIds:
          this.conversationsService.getActiveConversationIdsForUser(
            payload.sub,
          ),
        connectedAt: new Date(),
      });
      await this.emitPresenceSnapshot(client, payload.sub);
      await this.emitPresenceChange(payload.sub, true);
    } catch {
      this.metricsService.recordSocketError();
      this.logger.warn(
        JSON.stringify({
          type: "socket_connection_rejected",
          socketId: client.id,
        }),
      );
      client.emit("exception", {
        success: false,
        code: "UNAUTHORIZED",
        message: "Unauthorized socket connection",
        timestamp: new Date().toISOString(),
      });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.socketRateLimiterService.clear(client.id);
    const user = client.data.user;

    if (!user) {
      return;
    }

    const userStillOnline = this.untrackOnlineSocket(user.id, client.id);
    this.authenticatedSockets.delete(client.id);
    this.metricsService.recordSocketDisconnect();
    this.logger.log(
      JSON.stringify({
        type: "socket_disconnected",
        socketId: client.id,
        userId: user.id,
      }),
    );

    if (userStillOnline) {
      return;
    }

    await this.finishCallsForUser(user.id, "peer-disconnected");
    await this.emitPresenceChange(user.id, false);

    for (const conversationId of client.data.conversationIds ?? []) {
      this.server
        .to(this.conversationRoom(conversationId))
        .emit("presence:offline", {
          conversationId,
          userId: user.id,
        });
    }
  }

  @SubscribeMessage("presence:sync")
  async syncPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "presence:sync");
    const user = this.getUser(client);
    const snapshot = await this.buildPresenceSnapshot(user.id);
    const response = { success: true, data: snapshot };

    ack?.(response);
    client.emit("presence:contacts", snapshot);

    return response;
  }

  @SubscribeMessage("conversation:join")
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "conversation:join");
    const user = this.getUser(client);
    const conversation = await this.conversationsService.findOneForUser(
      payload.conversationId,
      user.id,
    );

    await client.join(this.conversationRoom(conversation.id));
    client.data.conversationIds?.add(conversation.id);

    const presenceSnapshot = {
      conversationId: conversation.id,
      users: conversation.participants
        .filter((participant) => !participant.leftAt)
        .map((participant) => ({
          userId: participant.userId,
          online: this.isUserOnline(participant.userId),
        })),
    };

    const response = { success: true, data: conversation };

    ack?.(response);
    client.emit("conversation:joined", conversation);
    client.emit("presence:snapshot", presenceSnapshot);
    client.to(this.conversationRoom(conversation.id)).emit("presence:online", {
      conversationId: conversation.id,
      userId: user.id,
    });

    return response;
  }

  @SubscribeMessage("message:send")
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "message:send");
    const user = this.getUser(client);
    const message = await this.conversationsService.createMessage(
      payload.conversationId,
      user.id,
      {
        content: payload.content,
        clientMessageId: payload.clientMessageId,
      } satisfies CreateMessageDto,
    );

    const response = { success: true, data: message };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("conversation:sync")
  async syncConversations(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SyncConversationsPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "conversation:sync");
    const user = this.getUser(client);

    for (const conversationId of payload.conversationIds) {
      await this.conversationsService.findOneForUser(conversationId, user.id);
      await client.join(this.conversationRoom(conversationId));
      client.data.conversationIds?.add(conversationId);
    }

    const syncState = {
      conversationIds: payload.conversationIds,
      syncedAt: new Date(),
    };
    const response = { success: true, data: syncState };

    ack?.(response);
    client.emit("conversation:synced", syncState);

    return response;
  }

  @SubscribeMessage("conversation:unsubscribe")
  async unsubscribeConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "conversation:unsubscribe");
    this.getUser(client);
    await client.leave(this.conversationRoom(payload.conversationId));
    client.data.conversationIds?.delete(payload.conversationId);

    const response = {
      success: true,
      data: { conversationId: payload.conversationId },
    };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("conversation:leave")
  async leaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "conversation:leave");
    const user = this.getUser(client);
    const leftState = await this.conversationsService.leaveConversation(
      payload.conversationId,
      user.id,
    );
    const response = { success: true, data: leftState };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("conversation:update")
  async updateConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UpdateConversationPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "conversation:update");
    const user = this.getUser(client);
    const conversation =
      await this.conversationsService.updateGroupConversation(
        payload.conversationId,
        user.id,
        user.role,
        { name: payload.name } satisfies UpdateGroupConversationDto,
      );

    const response = { success: true, data: conversation };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("conversation:transfer-owner")
  async transferOwner(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TransferOwnerPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "conversation:transfer-owner");
    const user = this.getUser(client);
    const conversation = await this.conversationsService.transferGroupOwner(
      payload.conversationId,
      user.id,
      user.role,
      { userId: payload.userId } satisfies TransferGroupOwnerDto,
    );

    const response = { success: true, data: conversation };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("message:update")
  async updateMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UpdateMessagePayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "message:update");
    const user = this.getUser(client);
    const message = await this.conversationsService.updateMessage(
      payload.conversationId,
      payload.messageId,
      user.id,
      { content: payload.content } satisfies UpdateMessageDto,
    );

    const response = { success: true, data: message };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("message:delete")
  async deleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessagePayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "message:delete");
    const user = this.getUser(client);
    const message = await this.conversationsService.deleteMessage(
      payload.conversationId,
      payload.messageId,
      user.id,
    );

    const response = { success: true, data: message };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("typing:start")
  async startTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "typing:start");
    const response = await this.emitConversationUserEvent(
      client,
      payload,
      "typing:started",
    );

    ack?.(response);

    return response;
  }

  @SubscribeMessage("typing:stop")
  async stopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "typing:stop");
    const response = await this.emitConversationUserEvent(
      client,
      payload,
      "typing:stopped",
    );

    ack?.(response);

    return response;
  }

  @SubscribeMessage("message:read")
  async markMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "message:read");
    const user = this.getUser(client);
    const readState = await this.conversationsService.markAsRead(
      payload.conversationId,
      user.id,
    );
    const response = { success: true, data: readState };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("call:start")
  async startCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: StartCallPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "call:start");
    const user = this.getUser(client);
    const conversation = await this.conversationsService.findOneForUser(
      payload.conversationId,
      user.id,
    );

    if (conversation.type !== ConversationType.Direct) {
      throw this.callException(
        "DIRECT_CALLS_ONLY",
        "Audio calls are only available in direct conversations",
      );
    }

    const targetParticipant = conversation.participants.find(
      (participant) =>
        participant.userId === payload.targetUserId && !participant.leftAt,
    );

    if (!targetParticipant || payload.targetUserId === user.id) {
      throw this.callException(
        "INVALID_CALL_RECIPIENT",
        "The selected user is not an active participant",
      );
    }

    const [caller, recipient] = await Promise.all([
      this.usersService.findById(user.id),
      this.usersService.findById(payload.targetUserId),
    ]);

    if (!caller || !recipient) {
      throw this.callException(
        "CALL_USER_NOT_FOUND",
        "A call participant could not be found",
      );
    }

    if (caller.isBot || recipient.isBot) {
      throw this.callException(
        "BOT_CALLS_NOT_SUPPORTED",
        "Automation bots cannot join audio calls",
      );
    }

    if (!this.isUserOnline(recipient.id)) {
      throw this.callException(
        "RECIPIENT_OFFLINE",
        "The user is currently offline",
      );
    }

    if (this.findCallForUser(user.id) || this.findCallForUser(recipient.id)) {
      throw this.callException(
        "USER_BUSY",
        "One of the participants is already in a call",
      );
    }

    const session: CallSession = {
      id: randomUUID(),
      conversationId: conversation.id,
      callerId: user.id,
      recipientId: recipient.id,
      status: "ringing",
      createdAt: new Date(),
    };
    await this.callsService.start({
      id: session.id,
      conversationId: session.conversationId,
      callerId: session.callerId,
      recipientId: session.recipientId,
      startedAt: session.createdAt,
    });
    this.callSessions.set(session.id, session);
    this.callTimeouts.set(
      session.id,
      setTimeout(
        () => void this.finishCall(session, "unanswered"),
        this.callRingTimeoutMs,
      ),
    );

    const response = { success: true, data: this.toCallState(session) };
    ack?.(response);
    this.emitCallHistoryUpdated(session);
    this.server.to(this.userRoom(recipient.id)).emit("call:incoming", {
      ...this.toCallState(session),
      caller: {
        id: caller.id,
        username: caller.username,
        profileImage: caller.profileImage,
      },
    });

    return response;
  }

  @SubscribeMessage("call:accept")
  async acceptCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CallEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "call:accept");
    const user = this.getUser(client);
    const session = this.getCallForUser(payload.callId, user.id);

    if (session.recipientId !== user.id || session.status !== "ringing") {
      throw this.callException(
        "CALL_CANNOT_BE_ACCEPTED",
        "This call can no longer be accepted",
      );
    }

    if (!this.isUserOnline(session.callerId)) {
      await this.finishCall(session, "caller-unavailable");
      throw this.callException(
        "CALLER_OFFLINE",
        "The caller is no longer available",
      );
    }

    session.status = "active";
    this.clearCallTimeout(session.id);
    await this.callsService.accept(session.id);
    this.emitCallHistoryUpdated(session);
    const response = { success: true, data: this.toCallState(session) };
    ack?.(response);
    this.server
      .to(this.userRoom(session.callerId))
      .emit("call:accepted", this.toCallState(session));
    client
      .to(this.userRoom(session.recipientId))
      .emit("call:answered-elsewhere", this.toCallState(session));

    return response;
  }

  @SubscribeMessage("call:reject")
  async rejectCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RejectCallPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "call:reject");
    const user = this.getUser(client);
    const session = this.getCallForUser(payload.callId, user.id);

    if (session.recipientId !== user.id || session.status !== "ringing") {
      throw this.callException(
        "CALL_CANNOT_BE_REJECTED",
        "This call can no longer be rejected",
      );
    }

    const reason = payload.reason ?? "declined";
    const response = {
      success: true,
      data: { ...this.toCallState(session), reason },
    };
    ack?.(response);
    this.server.to(this.userRoom(session.callerId)).emit("call:rejected", {
      ...this.toCallState(session),
      reason,
    });
    client.to(this.userRoom(session.recipientId)).emit("call:dismissed", {
      callId: session.id,
    });
    await this.callsService.finish(session.id, reason, user.id);
    this.emitCallHistoryUpdated(session);
    this.clearCall(session.id);

    return response;
  }

  @SubscribeMessage("call:signal")
  signalCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CallSignalPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "call:signal");
    const user = this.getUser(client);
    const session = this.getCallForUser(payload.callId, user.id);

    if (session.status !== "active") {
      throw this.callException(
        "CALL_NOT_ACTIVE",
        "Call signaling is only allowed for active calls",
      );
    }

    if (
      (payload.signalType === "offer" && user.id !== session.callerId) ||
      (payload.signalType === "answer" && user.id !== session.recipientId)
    ) {
      throw this.callException(
        "INVALID_CALL_SIGNAL",
        "This participant cannot send the requested signal",
      );
    }

    if (
      (payload.signalType === "ice-candidate" && !payload.candidate) ||
      (payload.signalType !== "ice-candidate" && !payload.sdp)
    ) {
      throw this.callException(
        "INVALID_CALL_SIGNAL",
        "The call signal is incomplete",
      );
    }

    const targetUserId =
      user.id === session.callerId ? session.recipientId : session.callerId;
    const signal = {
      ...payload,
      conversationId: session.conversationId,
      fromUserId: user.id,
    };
    this.server.to(this.userRoom(targetUserId)).emit("call:signal", signal);

    const response = {
      success: true,
      data: { callId: session.id, signalType: payload.signalType },
    };
    ack?.(response);

    return response;
  }

  @SubscribeMessage("call:end")
  async endCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CallEventPayloadDto,
    @Ack() ack?: (response: unknown) => void,
  ) {
    this.consumeRateLimit(client, "call:end");
    const user = this.getUser(client);
    const session = this.getCallForUser(payload.callId, user.id);
    const response = {
      success: true,
      data: { ...this.toCallState(session), reason: "ended", endedBy: user.id },
    };

    ack?.(response);
    await this.finishCall(session, "ended", user.id);

    return response;
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === "string" && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, "");
    }

    const header = client.handshake.headers.authorization;

    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice("Bearer ".length);
    }

    throw new WsException({
      code: "UNAUTHORIZED",
      message: "Missing socket auth token",
    });
  }

  private getUser(client: AuthenticatedSocket) {
    const user = client.data.user;

    if (!user) {
      throw new WsException({
        code: "UNAUTHORIZED",
        message: "Unauthorized socket connection",
      });
    }

    return user;
  }

  private consumeRateLimit(client: AuthenticatedSocket, eventName: string) {
    this.metricsService.recordSocketEvent(eventName);
    this.socketRateLimiterService.consume(client.id, eventName);
  }

  private async emitConversationUserEvent(
    client: AuthenticatedSocket,
    payload: ConversationEventPayloadDto,
    eventName: "typing:started" | "typing:stopped",
  ) {
    const user = this.getUser(client);
    await this.conversationsService.findOneForUser(
      payload.conversationId,
      user.id,
    );

    const eventPayload = {
      conversationId: payload.conversationId,
      userId: user.id,
    };

    client
      .to(this.conversationRoom(payload.conversationId))
      .emit(eventName, eventPayload);

    return { success: true, data: eventPayload };
  }

  private trackOnlineSocket(userId: string, socketId: string) {
    const socketIds = this.onlineUserSockets.get(userId) ?? new Set<string>();
    socketIds.add(socketId);
    this.onlineUserSockets.set(userId, socketIds);
  }

  private untrackOnlineSocket(userId: string, socketId: string) {
    const socketIds = this.onlineUserSockets.get(userId);

    if (!socketIds) {
      return false;
    }

    socketIds.delete(socketId);

    if (socketIds.size === 0) {
      this.onlineUserSockets.delete(userId);
      return false;
    }

    return true;
  }

  private isUserOnline(userId: string) {
    return this.onlineUserSockets.has(userId);
  }

  private findCallForUser(userId: string) {
    return Array.from(this.callSessions.values()).find(
      (session) =>
        session.callerId === userId || session.recipientId === userId,
    );
  }

  private getCallForUser(callId: string, userId: string) {
    const session = this.callSessions.get(callId);

    if (
      !session ||
      (session.callerId !== userId && session.recipientId !== userId)
    ) {
      throw this.callException("CALL_NOT_FOUND", "Call not found");
    }

    return session;
  }

  private async finishCallsForUser(userId: string, reason: string) {
    const calls = Array.from(this.callSessions.values()).filter(
      (session) =>
        session.callerId === userId || session.recipientId === userId,
    );

    for (const session of calls) {
      await this.finishCall(session, reason, userId);
    }
  }

  private async finishCall(
    session: CallSession,
    reason: string,
    endedBy?: string,
  ) {
    if (!this.callSessions.has(session.id)) {
      return;
    }

    const payload = {
      ...this.toCallState(session),
      reason,
      endedBy: endedBy ?? null,
    };
    await this.callsService.finish(session.id, reason, endedBy);
    this.server
      .to(this.userRoom(session.callerId))
      .to(this.userRoom(session.recipientId))
      .emit("call:ended", payload);
    this.emitCallHistoryUpdated(session);
    this.clearCall(session.id);
  }

  private emitCallHistoryUpdated(session: CallSession) {
    this.server
      .to(this.userRoom(session.callerId))
      .to(this.userRoom(session.recipientId))
      .emit("call:history-updated", { callId: session.id });
  }

  private async buildPresenceSnapshot(userId: string) {
    const peerIds = await this.getPresencePeerIds(userId);
    return {
      users: Array.from(peerIds).map(peerId => ({
        userId: peerId,
        online: this.isUserOnline(peerId),
      })),
    };
  }

  private async emitPresenceSnapshot(
    client: AuthenticatedSocket,
    userId: string,
  ) {
    client.emit("presence:contacts", await this.buildPresenceSnapshot(userId));
  }

  private async emitPresenceChange(userId: string, online: boolean) {
    const eventName = online ? "presence:online" : "presence:offline";
    for (const peerId of await this.getPresencePeerIds(userId)) {
      for (const socketId of this.onlineUserSockets.get(peerId) ?? []) {
        this.server.to(socketId).emit(eventName, { userId });
      }
    }
  }

  private async getPresencePeerIds(userId: string) {
    const peerIds = new Set<string>();
    const conversationIds =
      this.conversationsService.getActiveConversationIdsForUser(userId);

    for (const conversationId of conversationIds) {
      const conversation = await this.conversationsService.findOneForUser(
        conversationId,
        userId,
      );
      for (const participant of conversation.participants) {
        if (!participant.leftAt && participant.userId !== userId) {
          peerIds.add(participant.userId);
        }
      }
    }

    return peerIds;
  }

  private clearCall(callId: string) {
    this.clearCallTimeout(callId);
    this.callSessions.delete(callId);
  }

  private clearCallTimeout(callId: string) {
    const timeout = this.callTimeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.callTimeouts.delete(callId);
    }
  }

  private toCallState(session: CallSession) {
    return {
      callId: session.id,
      conversationId: session.conversationId,
      callerId: session.callerId,
      recipientId: session.recipientId,
      status: session.status,
      createdAt: session.createdAt,
    };
  }

  private callException(code: string, message: string) {
    return new WsException({ code, message });
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private broadcastRealtimeEvent(event: ConversationRealtimeEvent) {
    switch (event.type) {
      case "contact.invitation.created":
        this.server
          .to(this.userRoom(event.data.recipientId))
          .emit("contact:invitation:new", event.data);
        return;
      case "contact.invitation.updated":
        this.server
          .to(this.userRoom(event.data.senderId))
          .to(this.userRoom(event.data.recipientId))
          .emit("contact:invitation:updated", event.data);
        return;
      case "conversation.created":
        this.emitToConversationAudience(
          event.data.id,
          "conversation:created",
          event.data,
        );
        return;
      case "conversation.updated":
        this.emitToConversationAudience(
          event.data.id,
          "conversation:updated",
          event.data,
        );
        return;
      case "message.created":
        this.emitToConversationAudience(
          event.data.conversationId,
          "message:new",
          event.data,
        );
        return;
      case "message.updated":
        this.emitToConversationAudience(
          event.data.conversationId,
          "message:updated",
          event.data,
        );
        return;
      case "message.deleted":
        this.emitToConversationAudience(
          event.data.conversationId,
          "message:deleted",
          event.data,
        );
        return;
      case "message.read":
        this.emitToConversationAudience(
          event.data.conversationId,
          "message:read",
          event.data,
        );
        return;
      case "participant.added":
        this.emitToConversationAudience(
          event.data.conversationId,
          "participant:added",
          event.data,
        );
        return;
      case "participant.removed":
        this.broadcastParticipantRemoved(event.data);
        return;
      case "participant.left":
        this.broadcastParticipantLeft(event.data);
    }
  }

  private emitToConversationAudience(
    conversationId: string,
    eventName: string,
    payload: unknown,
  ) {
    let audience = this.server.to(this.conversationRoom(conversationId));

    for (const userId of this.conversationsService.getActiveParticipantIds(
      conversationId,
    )) {
      audience = audience.to(this.userRoom(userId));
    }

    audience.emit(eventName, payload);
  }

  private broadcastParticipantLeft(event: {
    conversationId: string;
    userId: string;
    leftAt: Date;
  }) {
    const conversationRoom = this.conversationRoom(event.conversationId);
    const userRoom = this.userRoom(event.userId);

    this.emitToConversationAudience(
      event.conversationId,
      "participant:left",
      event,
    );
    this.server.to(userRoom).emit("conversation:left", event);
    this.server.in(userRoom).socketsLeave(conversationRoom);

    for (const socketId of this.onlineUserSockets.get(event.userId) ?? []) {
      this.authenticatedSockets
        .get(socketId)
        ?.data.conversationIds?.delete(event.conversationId);
    }
  }

  private broadcastParticipantRemoved(event: {
    conversationId: string;
    userId: string;
    removedAt: Date;
    removedBy: string;
  }) {
    const conversationRoom = this.conversationRoom(event.conversationId);
    const userRoom = this.userRoom(event.userId);
    const legacyLeftEvent = {
      conversationId: event.conversationId,
      userId: event.userId,
      leftAt: event.removedAt,
    };

    this.emitToConversationAudience(
      event.conversationId,
      "participant:removed",
      event,
    );
    this.emitToConversationAudience(
      event.conversationId,
      "participant:left",
      legacyLeftEvent,
    );
    this.server.to(userRoom).emit("conversation:left", legacyLeftEvent);
    this.server.in(userRoom).socketsLeave(conversationRoom);

    for (const socketId of this.onlineUserSockets.get(event.userId) ?? []) {
      this.authenticatedSockets
        .get(socketId)
        ?.data.conversationIds?.delete(event.conversationId);
    }
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
