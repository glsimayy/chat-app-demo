import { Module } from "@nestjs/common";
import { AdminMonitoringModule } from "../admin-monitoring/admin-monitoring.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { UsersModule } from "../users/users.module";
import { AdminModerationController } from "./admin-moderation.controller";
import { MessageReportsController } from "./message-reports.controller";
import { ModerationService } from "./moderation.service";

@Module({
  imports: [AdminMonitoringModule, ConversationsModule, UsersModule],
  controllers: [MessageReportsController, AdminModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
