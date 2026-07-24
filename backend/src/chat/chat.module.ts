import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { CallsModule } from "../calls/calls.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { ChatGateway } from "./chat.gateway";
import { SocketExceptionFilter } from "./socket-exception.filter";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";

@Module({
  imports: [
    ConversationsModule,
    CallsModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET", "dev-secret"),
      }),
    }),
  ],
  providers: [ChatGateway, SocketExceptionFilter, SocketRateLimiterService],
})
export class ChatModule {}
