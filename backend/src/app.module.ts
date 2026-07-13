import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BotModule } from "./bot/bot.module";
import { ChatModule } from "./chat/chat.module";
import { validateEnv } from "./config/env.validation";
import { ConversationsModule } from "./conversations/conversations.module";
import { HealthModule } from "./health/health.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    ConversationsModule,
    ChatModule,
    BotModule,
  ],
})
export class AppModule {}
