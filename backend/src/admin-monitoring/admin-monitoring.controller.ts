import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { UserRole } from "../users/user-role.enum";
import {
  AdminAccessAuditListResponseDto,
  AdminMessageListResponseDto,
  AdminMessageRevealResponseDto,
  AdminOverviewResponseDto,
} from "./admin-monitoring-response.dto";
import { AdminMonitoringService } from "./admin-monitoring.service";
import { FindAdminAuditsQueryDto } from "./dto/find-admin-audits-query.dto";
import { FindAdminMessagesQueryDto } from "./dto/find-admin-messages-query.dto";
import { RevealAdminMessageDto } from "./dto/reveal-admin-message.dto";

@ApiTags("admin monitoring")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminMonitoringController {
  constructor(
    private readonly adminMonitoringService: AdminMonitoringService,
  ) {}

  @Get("overview")
  @ApiOperation({
    summary: "Get operational totals, recent activity and runtime metrics",
  })
  @ApiSuccessResponse(AdminOverviewResponseDto)
  getOverview() {
    return this.adminMonitoringService.getOverview();
  }

  @Get("messages")
  @ApiOperation({
    summary: "List message metadata without returning message contents",
  })
  @ApiSuccessResponse(AdminMessageListResponseDto)
  getMessages(@Query() query: FindAdminMessagesQueryDto) {
    return this.adminMonitoringService.getMessages(query);
  }

  @Post("messages/:messageId/reveal")
  @ApiOperation({
    summary: "Reveal one message after recording reason and justification",
  })
  @ApiSuccessResponse(AdminMessageRevealResponseDto)
  revealMessage(
    @Param("messageId") messageId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: RevealAdminMessageDto,
  ) {
    return this.adminMonitoringService.revealMessage(messageId, admin.id, dto);
  }

  @Get("messages/:messageId/attachments/:attachmentId")
  @ApiOperation({
    summary: "Read an attachment covered by a matching message access audit",
  })
  @ApiQuery({
    name: "auditId",
    description:
      "Audit identifier returned by the message reveal operation for this administrator",
  })
  @ApiProduces(
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
  )
  @ApiOkResponse({
    description: "Audited attachment content",
    schema: { type: "string", format: "binary" },
  })
  async getMessageAttachment(
    @Param("messageId") messageId: string,
    @Param("attachmentId") attachmentId: string,
    @Query("auditId") auditId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    const { attachment, data } =
      await this.adminMonitoringService.getMessageAttachment(
        messageId,
        attachmentId,
        auditId,
        admin.id,
      );
    const disposition = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
    ].includes(attachment.mimeType)
      ? "inline"
      : "attachment";
    const encodedFileName = encodeURIComponent(attachment.fileName).replace(
      /'/g,
      "%27",
    );

    return new StreamableFile(data, {
      type: attachment.mimeType,
      length: attachment.fileSize,
      disposition: `${disposition}; filename*=UTF-8''${encodedFileName}`,
    });
  }

  @Get("message-access-audits")
  @ApiOperation({
    summary: "List the audit trail for administrative message access",
  })
  @ApiSuccessResponse(AdminAccessAuditListResponseDto)
  getAccessAudits(@Query() query: FindAdminAuditsQueryDto) {
    return this.adminMonitoringService.getAccessAudits(query);
  }
}
