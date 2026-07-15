import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ConversationsModule } from "../conversations/conversations.module";
import { ChatGateway } from "./chat.gateway";
import { SocketExceptionFilter } from "./socket-exception.filter";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";

@Module({
  imports: [
    ConversationsModule,
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
