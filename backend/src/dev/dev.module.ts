import { Module } from "@nestjs/common";
import { BookmarksModule } from "../bookmarks/bookmarks.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { ContactInvitationsModule } from "../contact-invitations/contact-invitations.module";
import { TicketsModule } from "../tickets/tickets.module";
import { UsersModule } from "../users/users.module";
import { DevController } from "./dev.controller";

@Module({
  imports: [
    BookmarksModule,
    ContactInvitationsModule,
    ConversationsModule,
    TicketsModule,
    UsersModule,
  ],
  controllers: [DevController],
})
export class DevModule {}
