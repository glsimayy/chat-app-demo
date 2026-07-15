import {
  OnModuleDestroy,
  OnModuleInit,
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
import { Server, Socket } from "socket.io";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { ConversationsService } from "../conversations/conversations.service";
import { CreateMessageDto } from "../conversations/dto/create-message.dto";
import { TransferGroupOwnerDto } from "../conversations/dto/transfer-group-owner.dto";
import { UpdateGroupConversationDto } from "../conversations/dto/update-group-conversation.dto";
import { UpdateMessageDto } from "../conversations/dto/update-message.dto";
import {
  ConversationRealtimeEvent,
  RealtimeEventsService,
} from "../conversations/realtime-events.service";
import {
  ConversationEventPayloadDto,
  DeleteMessagePayloadDto,
  SendMessagePayloadDto,
  TransferOwnerPayloadDto,
  UpdateConversationPayloadDto,
  UpdateMessagePayloadDto,
} from "./dto/socket-event.dto";
import { SocketExceptionFilter } from "./socket-exception.filter";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";

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
  private removeRealtimeListener?: () => void;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly socketRateLimiterService: SocketRateLimiterService,
  ) {}

  onModuleInit() {
    this.removeRealtimeListener = this.realtimeEventsService.onEvent((event) =>
      this.broadcastRealtimeEvent(event),
    );
  }

  onModuleDestroy() {
    this.removeRealtimeListener?.();
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
      await client.join(this.userRoom(payload.sub));
    } catch {
      client.emit("exception", {
        success: false,
        code: "UNAUTHORIZED",
        message: "Unauthorized socket connection",
        timestamp: new Date().toISOString(),
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.socketRateLimiterService.clear(client.id);
    const user = client.data.user;

    if (!user) {
      return;
    }

    const userStillOnline = this.untrackOnlineSocket(user.id, client.id);
    this.authenticatedSockets.delete(client.id);

    if (userStillOnline) {
      return;
    }

    for (const conversationId of client.data.conversationIds ?? []) {
      this.server
        .to(this.conversationRoom(conversationId))
        .emit("presence:offline", {
          conversationId,
          userId: user.id,
        });
    }
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
      { content: payload.content } satisfies CreateMessageDto,
    );

    const response = { success: true, data: message };

    ack?.(response);

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

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private broadcastRealtimeEvent(event: ConversationRealtimeEvent) {
    switch (event.type) {
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
