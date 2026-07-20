import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { BotController } from "./bot.controller";
import { BotService } from "./bot.service";

@Module({
  imports: [ConversationsModule, UsersModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
