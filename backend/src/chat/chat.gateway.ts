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
import { UpdateGroupConversationDto } from "../conversations/dto/update-group-conversation.dto";
import { UpdateMessageDto } from "../conversations/dto/update-message.dto";

interface AuthenticatedSocket extends Socket {
  data: {
    conversationIds?: Set<string>;
    user?: AuthenticatedUser;
  };
}

interface JoinConversationPayload {
  conversationId: string;
}

interface SendMessagePayload {
  conversationId: string;
  content: string;
}

interface ConversationEventPayload {
  conversationId: string;
}

interface UpdateMessagePayload {
  conversationId: string;
  messageId: string;
  content: string;
}

interface DeleteMessagePayload {
  conversationId: string;
  messageId: string;
}

interface UpdateConversationPayload {
  conversationId: string;
  name: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: AuthenticatedUser["role"];
}

@WebSocketGateway({
  namespace: "chat",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly onlineUserSockets = new Map<string, Set<string>>();

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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
      await client.join(this.userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const user = client.data.user;

    if (!user) {
      return;
    }

    const userStillOnline = this.untrackOnlineSocket(user.id, client.id);

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
    @MessageBody() payload: JoinConversationPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
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
    @MessageBody() payload: SendMessagePayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    const user = this.getUser(client);
    const message = await this.conversationsService.createMessage(
      payload.conversationId,
      user.id,
      { content: payload.content } satisfies CreateMessageDto,
    );

    this.server
      .to(this.conversationRoom(payload.conversationId))
      .emit("message:new", message);

    const response = { success: true, data: message };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("conversation:leave")
  async leaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    const user = this.getUser(client);
    const leftState = await this.conversationsService.leaveConversation(
      payload.conversationId,
      user.id,
    );
    const room = this.conversationRoom(payload.conversationId);

    client.to(room).emit("participant:left", leftState);
    await client.leave(room);
    client.data.conversationIds?.delete(payload.conversationId);
    client.emit("conversation:left", leftState);

    const response = { success: true, data: leftState };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("conversation:update")
  async updateConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UpdateConversationPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    const user = this.getUser(client);
    const conversation =
      await this.conversationsService.updateGroupConversation(
        payload.conversationId,
        user.id,
        user.role,
        { name: payload.name } satisfies UpdateGroupConversationDto,
      );

    this.server
      .to(this.conversationRoom(payload.conversationId))
      .emit("conversation:updated", conversation);

    const response = { success: true, data: conversation };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("message:update")
  async updateMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UpdateMessagePayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    const user = this.getUser(client);
    const message = await this.conversationsService.updateMessage(
      payload.conversationId,
      payload.messageId,
      user.id,
      { content: payload.content } satisfies UpdateMessageDto,
    );

    this.server
      .to(this.conversationRoom(payload.conversationId))
      .emit("message:updated", message);

    const response = { success: true, data: message };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("message:delete")
  async deleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessagePayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    const user = this.getUser(client);
    const message = await this.conversationsService.deleteMessage(
      payload.conversationId,
      payload.messageId,
      user.id,
    );

    this.server
      .to(this.conversationRoom(payload.conversationId))
      .emit("message:deleted", message);

    const response = { success: true, data: message };

    ack?.(response);

    return response;
  }

  @SubscribeMessage("typing:start")
  async startTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ConversationEventPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
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
    @MessageBody() payload: ConversationEventPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
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
    @MessageBody() payload: ConversationEventPayload,
    @Ack() ack?: (response: unknown) => void,
  ) {
    const user = this.getUser(client);
    const readState = await this.conversationsService.markAsRead(
      payload.conversationId,
      user.id,
    );
    const eventPayload = {
      conversationId: payload.conversationId,
      userId: user.id,
      readAt: readState.readAt,
    };

    this.server
      .to(this.conversationRoom(payload.conversationId))
      .emit("message:read", eventPayload);

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

    throw new WsException("Missing socket auth token");
  }

  private getUser(client: AuthenticatedSocket) {
    const user = client.data.user;

    if (!user) {
      throw new WsException("Unauthorized socket connection");
    }

    return user;
  }

  private async emitConversationUserEvent(
    client: AuthenticatedSocket,
    payload: ConversationEventPayload,
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

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
