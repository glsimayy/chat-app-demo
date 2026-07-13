import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { BotController } from "./bot.controller";

@Module({
  imports: [ConversationsModule],
  controllers: [BotController],
})
export class BotModule {}
