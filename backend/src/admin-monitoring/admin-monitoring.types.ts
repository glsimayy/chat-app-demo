import { AdminMessageAccessReason } from "./admin-message-access-reason.enum";

export interface AdminMessageAccessAuditRecord {
  id: string;
  adminId: string;
  messageId: string;
  reason: AdminMessageAccessReason;
  justification: string;
  createdAt: Date;
}
