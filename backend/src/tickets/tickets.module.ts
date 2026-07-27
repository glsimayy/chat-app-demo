import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [ConversationsModule, UsersModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
