import { Module } from "@nestjs/common";
import { AdminMonitoringModule } from "../admin-monitoring/admin-monitoring.module";
import { BookmarksModule } from "../bookmarks/bookmarks.module";
import { CallsModule } from "../calls/calls.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { ContactInvitationsModule } from "../contact-invitations/contact-invitations.module";
import { ModerationModule } from "../moderation/moderation.module";
import { TicketsModule } from "../tickets/tickets.module";
import { UsersModule } from "../users/users.module";
import { DevController } from "./dev.controller";

@Module({
  imports: [
    AdminMonitoringModule,
    BookmarksModule,
    CallsModule,
    ContactInvitationsModule,
    ConversationsModule,
    ModerationModule,
    TicketsModule,
    UsersModule,
  ],
  controllers: [DevController],
})
export class DevModule {}
