import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import {
  MessageReportReason as PrismaMessageReportReason,
  MessageReportStatus as PrismaMessageReportStatus,
  ModerationResolutionAction as PrismaModerationResolutionAction,
} from "@prisma/client";
import { AdminMonitoringService } from "../admin-monitoring/admin-monitoring.service";
import { ConversationsService } from "../conversations/conversations.service";
import { MessageType } from "../conversations/message-type.enum";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../users/user-role.enum";
import { UsersService } from "../users/users.service";
import { CreateMessageReportDto } from "./dto/create-message-report.dto";
import { FindMessageReportsQueryDto } from "./dto/find-message-reports-query.dto";
import { ResolveMessageReportDto } from "./dto/resolve-message-report.dto";
import { MessageReportReason } from "./message-report-reason.enum";
import { MessageReportStatus } from "./message-report-status.enum";
import { MessageReportRecord } from "./moderation.types";
import { ModerationResolutionAction } from "./moderation-resolution-action.enum";

@Injectable()
export class ModerationService implements OnModuleInit {
  private readonly reports = new Map<string, MessageReportRecord>();

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
    private readonly adminMonitoringService: AdminMonitoringService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const reports = await this.prismaService.client.messageReport.findMany({
      orderBy: { createdAt: "desc" },
    });
    for (const report of reports) {
      this.reports.set(report.id, {
        ...report,
        reason: report.reason as MessageReportReason,
        status: report.status as MessageReportStatus,
        resolutionAction:
          report.resolutionAction as ModerationResolutionAction | null,
      });
    }
  }

  async createReport(reporterId: string, dto: CreateMessageReportDto) {
    const { message } = await this.conversationsService.findMessageForUser(
      dto.messageId,
      reporterId,
    );

    if (
      message.messageType !== MessageType.User ||
      !message.senderId ||
      message.deletedAt
    ) {
      throw new BadRequestException("This message cannot be reported");
    }
    if (message.senderId === reporterId) {
      throw new BadRequestException("You cannot report your own message");
    }
    if (
      Array.from(this.reports.values()).some(
        (report) =>
          report.messageId === dto.messageId &&
          report.reporterId === reporterId,
      )
    ) {
      throw new ConflictException("You already reported this message");
    }

    const now = new Date();
    const report: MessageReportRecord = {
      id: crypto.randomUUID(),
      messageId: dto.messageId,
      reporterId,
      reason: dto.reason,
      details: dto.details?.trim() || null,
      status: MessageReportStatus.Pending,
      resolutionAction: null,
      resolutionNote: null,
      reviewedByAdminId: null,
      evidenceAuditId: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };

    if (this.prismaService?.enabled) {
      await this.prismaService.client.messageReport.create({
        data: {
          ...report,
          reason: report.reason as unknown as PrismaMessageReportReason,
          status: report.status as unknown as PrismaMessageReportStatus,
        },
      });
    }

    this.reports.set(report.id, report);
    return {
      id: report.id,
      messageId: report.messageId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  findAll(adminId: string, query: FindMessageReportsQueryDto) {
    const filtered = Array.from(this.reports.values())
      .filter((report) => this.isVisibleToAdmin(report, adminId))
      .filter((report) => !query.status || report.status === query.status)
      .filter((report) => !query.reason || report.reason === query.reason)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;

    return {
      items: filtered
        .slice(offset, offset + limit)
        .map((report) => this.toAdminResponse(report)),
      pageInfo: {
        limit,
        offset,
        total: filtered.length,
        hasMore: offset + limit < filtered.length,
      },
    };
  }

  async resolveReport(
    reportId: string,
    adminId: string,
    dto: ResolveMessageReportDto,
  ) {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new NotFoundException("Message report not found");
    }

    const message = this.conversationsService.findMessageForAdmin(
      report.messageId,
    );
    if (!message || message.senderId === adminId) {
      throw new NotFoundException("Message report not found");
    }

    if (report.status !== MessageReportStatus.Pending) {
      throw new ConflictException("Message report is already resolved");
    }

    this.adminMonitoringService.assertMatchingAudit(
      dto.evidenceAuditId,
      adminId,
      report.messageId,
    );

    const reportedUser = message.senderId
      ? this.usersService.findByIdSync(message.senderId)
      : undefined;

    if (
      [
        ModerationResolutionAction.WarnUser,
        ModerationResolutionAction.SuspendUser,
      ].includes(dto.action)
    ) {
      if (!reportedUser) {
        throw new BadRequestException("Reported user no longer exists");
      }
      if (reportedUser.role === UserRole.Admin || reportedUser.isBot) {
        throw new BadRequestException(
          "Protected accounts cannot be warned or suspended here",
        );
      }
    }

    if (dto.action === ModerationResolutionAction.DeleteMessage) {
      await this.conversationsService.deleteMessageAsAdmin(report.messageId);
    } else if (dto.action === ModerationResolutionAction.WarnUser) {
      await this.usersService.addModerationWarning(reportedUser!.id);
    } else if (dto.action === ModerationResolutionAction.SuspendUser) {
      const suspensionHours = dto.suspensionHours ?? 24;
      await this.usersService.suspendUser(
        reportedUser!.id,
        new Date(Date.now() + suspensionHours * 60 * 60 * 1000),
        dto.note.trim(),
      );
    }

    const now = new Date();
    report.status =
      dto.action === ModerationResolutionAction.Dismiss
        ? MessageReportStatus.Dismissed
        : MessageReportStatus.Resolved;
    report.resolutionAction = dto.action;
    report.resolutionNote = dto.note.trim();
    report.reviewedByAdminId = adminId;
    report.evidenceAuditId = dto.evidenceAuditId;
    report.updatedAt = now;
    report.resolvedAt = now;

    if (this.prismaService?.enabled) {
      await this.prismaService.client.messageReport.update({
        where: { id: report.id },
        data: {
          status: report.status as unknown as PrismaMessageReportStatus,
          resolutionAction:
            report.resolutionAction as unknown as PrismaModerationResolutionAction,
          resolutionNote: report.resolutionNote,
          reviewedByAdminId: report.reviewedByAdminId,
          evidenceAuditId: report.evidenceAuditId,
          resolvedAt: report.resolvedAt,
        },
      });
    }

    return this.toAdminResponse(report);
  }

  async clearAll() {
    const deletedMessageReports = this.reports.size;
    if (this.prismaService?.enabled) {
      await this.prismaService.client.messageReport.deleteMany();
    }
    this.reports.clear();
    return { deletedMessageReports };
  }

  private toAdminResponse(report: MessageReportRecord) {
    const message = this.adminMonitoringService.getMessageMetadata(
      report.messageId,
    );
    const reporter = this.toIdentity(report.reporterId);
    const reportedUser = message.sender
      ? {
          ...this.toIdentity(message.sender.id),
          ...this.usersService.getModerationProfile(message.sender.id),
        }
      : null;

    return {
      ...report,
      reporter,
      reportedUser,
      reviewedByAdmin: report.reviewedByAdminId
        ? this.toIdentity(report.reviewedByAdminId)
        : null,
      message,
    };
  }

  private isVisibleToAdmin(report: MessageReportRecord, adminId: string) {
    const message = this.conversationsService.findMessageForAdmin(
      report.messageId,
    );
    return Boolean(message && message.senderId !== adminId);
  }

  private toIdentity(userId: string) {
    const user = this.usersService.findByIdSync(userId);
    return user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isBot: user.isBot,
        }
      : null;
  }
}
