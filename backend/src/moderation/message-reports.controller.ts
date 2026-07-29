import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { CreateMessageReportDto } from "./dto/create-message-report.dto";
import { MessageReportResponseDto } from "./moderation-response.dto";
import { ModerationService } from "./moderation.service";

@ApiTags("message reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("message-reports")
export class MessageReportsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @ApiOperation({ summary: "Report a visible message for moderator review" })
  @ApiSuccessResponse(MessageReportResponseDto, { status: 201 })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMessageReportDto,
  ) {
    return this.moderationService.createReport(user.id, dto);
  }
}
