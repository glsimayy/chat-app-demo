import {
  Controller,
  ForbiddenException,
  Headers,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import { AdminMonitoringService } from "../admin-monitoring/admin-monitoring.service";
import { BookmarksService } from "../bookmarks/bookmarks.service";
import { CallsService } from "../calls/calls.service";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { DevResetResponseDto } from "../common/swagger/backend-response.dto";
import { ConversationsService } from "../conversations/conversations.service";
import { ContactInvitationsService } from "../contact-invitations/contact-invitations.service";
import { ModerationService } from "../moderation/moderation.service";
import { TicketsService } from "../tickets/tickets.service";
import { UsersService } from "../users/users.service";

@ApiTags("dev")
@Controller("dev")
export class DevController {
  constructor(
    private readonly configService: ConfigService,
    private readonly adminMonitoringService: AdminMonitoringService,
    private readonly bookmarksService: BookmarksService,
    private readonly callsService: CallsService,
    private readonly contactInvitationsService: ContactInvitationsService,
    private readonly conversationsService: ConversationsService,
    private readonly moderationService: ModerationService,
    private readonly ticketsService: TicketsService,
    private readonly usersService: UsersService,
  ) {}

  @Post("reset")
  @ApiHeader({
    name: "x-dev-secret",
    description: "Development reset secret configured on the backend",
  })
  @ApiSuccessResponse(DevResetResponseDto, {
    description: "Development-only data reset",
  })
  async resetInMemoryData(@Headers("x-dev-secret") providedSecret?: string) {
    if (
      this.configService.get<string>("DEV_ROUTES_ENABLED", "false") !== "true"
    ) {
      throw new NotFoundException("Route not found");
    }

    const expectedSecret = this.configService.get<string>("DEV_RESET_SECRET");

    if (!expectedSecret || providedSecret !== expectedSecret) {
      throw new ForbiddenException("Invalid or missing dev reset secret");
    }

    const adminMonitoring = await this.adminMonitoringService.clearAll();
    const bookmarks = await this.bookmarksService.clearAll();
    const calls = await this.callsService.clearAll();
    const contactInvitations = await this.contactInvitationsService.clearAll();
    const moderation = await this.moderationService.clearAll();
    const conversations = await this.conversationsService.clearAll();
    const tickets = await this.ticketsService.clearAll();
    const users = await this.usersService.clearAll();

    return {
      adminMonitoring,
      bookmarks,
      calls,
      contactInvitations,
      moderation,
      conversations,
      tickets,
      users,
    };
  }
}
