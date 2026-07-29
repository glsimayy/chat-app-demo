import { Module } from "@nestjs/common";
import { CallsModule } from "../calls/calls.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { TicketsModule } from "../tickets/tickets.module";
import { UsersModule } from "../users/users.module";
import { AdminMonitoringController } from "./admin-monitoring.controller";
import { AdminMonitoringService } from "./admin-monitoring.service";

@Module({
  imports: [UsersModule, ConversationsModule, CallsModule, TicketsModule],
  controllers: [AdminMonitoringController],
  providers: [AdminMonitoringService],
  exports: [AdminMonitoringService],
})
export class AdminMonitoringModule {}
