import { APIClient } from "./apiCore";
import { AdminIdentity, AdminMessageMetadata } from "./adminMonitoring";

const api = new APIClient();

export type MessageReportReason =
  | "harassment"
  | "sexual_content"
  | "violence_or_threat"
  | "spam"
  | "impersonation"
  | "other";

export type MessageReportStatus = "pending" | "resolved" | "dismissed";

export type ModerationResolutionAction =
  "dismiss" | "delete_message" | "warn_user" | "suspend_user";

export interface AdminModerationIdentity extends AdminIdentity {
  role: "admin" | "user";
  isBot: boolean;
}

export interface AdminModerationReport {
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
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reporter: AdminModerationIdentity | null;
  reportedUser:
    | (AdminModerationIdentity & {
        warningCount: number;
        suspendedUntil: string | null;
        suspensionReason: string | null;
      })
    | null;
  reviewedByAdmin: AdminModerationIdentity | null;
  message: AdminMessageMetadata;
}

export interface AdminModerationReportList {
  items: AdminModerationReport[];
  pageInfo: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export const createMessageReport = (data: {
  messageId: string;
  reason: MessageReportReason;
  details?: string;
}) =>
  api.create("/message-reports", data) as unknown as Promise<{
    id: string;
    messageId: string;
    reason: MessageReportReason;
    status: MessageReportStatus;
    createdAt: string;
  }>;

export const getAdminModerationReports = (
  params: {
    status?: MessageReportStatus;
    reason?: MessageReportReason;
    limit?: number;
    offset?: number;
  } = {},
) =>
  api.get("/admin/moderation/reports", {
    params,
  }) as unknown as Promise<AdminModerationReportList>;

export const resolveAdminModerationReport = (
  reportId: string,
  data: {
    action: ModerationResolutionAction;
    note: string;
    evidenceAuditId: string;
    suspensionHours?: number;
  },
) =>
  api.patch(
    `/admin/moderation/reports/${reportId}/resolve`,
    data,
  ) as unknown as Promise<AdminModerationReport>;
