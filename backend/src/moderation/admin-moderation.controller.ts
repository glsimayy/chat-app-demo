import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { UserRole } from "../users/user-role.enum";
import { FindMessageReportsQueryDto } from "./dto/find-message-reports-query.dto";
import { ResolveMessageReportDto } from "./dto/resolve-message-report.dto";
import {
  MessageReportListResponseDto,
  MessageReportResponseDto,
} from "./moderation-response.dto";
import { ModerationService } from "./moderation.service";

@ApiTags("admin moderation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller("admin/moderation")
export class AdminModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get("reports")
  @ApiOperation({ summary: "List masked message reports for moderation" })
  @ApiSuccessResponse(MessageReportListResponseDto)
  findAll(@Query() query: FindMessageReportsQueryDto) {
    return this.moderationService.findAll(query);
  }

  @Patch("reports/:reportId/resolve")
  @ApiOperation({
    summary: "Resolve a report using evidence covered by an admin access audit",
  })
  @ApiSuccessResponse(MessageReportResponseDto)
  resolve(
    @Param("reportId") reportId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ResolveMessageReportDto,
  ) {
    return this.moderationService.resolveReport(reportId, admin.id, dto);
  }
}
