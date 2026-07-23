import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { ContactInvitationsController } from "./contact-invitations.controller";
import { ContactInvitationsService } from "./contact-invitations.service";

@Module({
  imports: [UsersModule, ConversationsModule],
  controllers: [ContactInvitationsController],
  providers: [ContactInvitationsService],
  exports: [ContactInvitationsService],
})
export class ContactInvitationsModule {}
