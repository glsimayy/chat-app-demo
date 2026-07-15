import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/roles.guard";
import { UsersModule } from "../users/users.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { RealtimeEventsService } from "./realtime-events.service";

@Module({
  imports: [UsersModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, RealtimeEventsService, RolesGuard],
  exports: [ConversationsService, RealtimeEventsService],
})
export class ConversationsModule {}
