import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { DevController } from "./dev.controller";

@Module({
  imports: [ConversationsModule, UsersModule],
  controllers: [DevController],
})
export class DevModule {}
