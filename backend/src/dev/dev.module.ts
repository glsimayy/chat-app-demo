import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { ContactInvitationsModule } from "../contact-invitations/contact-invitations.module";
import { TicketsModule } from "../tickets/tickets.module";
import { UsersModule } from "../users/users.module";
import { DevController } from "./dev.controller";

@Module({
  imports: [
    ContactInvitationsModule,
    ConversationsModule,
    TicketsModule,
    UsersModule,
  ],
  controllers: [DevController],
})
export class DevModule {}
