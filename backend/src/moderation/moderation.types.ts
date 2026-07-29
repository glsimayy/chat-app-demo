import { MessageReportReason } from "./message-report-reason.enum";
import { MessageReportStatus } from "./message-report-status.enum";
import { ModerationResolutionAction } from "./moderation-resolution-action.enum";

export interface MessageReportRecord {
  id: string;
  messageId: string;
  reporterId: string;
  reason: MessageReportReason;
  details: string | null;
  status: MessageReportStatus;
  resolutionAction: ModerationResolutionAction | null;
  resolutionNote: string | null;
  reviewedByAdminId: string | null;
  evidenceAuditId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}
