import { SupportTicketPriority } from "./support-ticket-priority.enum";
import { SupportTicketStatus } from "./support-ticket-status.enum";
import { SupportTicketActivityAction } from "./support-ticket-activity-action.enum";

export interface SupportTicketRecord {
  id: string;
  requesterId: string;
  assignedAdminId: string | null;
  subject: string;
  message: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  adminNote: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface SupportTicketActivityRecord {
  id: string;
  ticketId: string;
  actorId: string | null;
  action: SupportTicketActivityAction;
  fromValue: string | null;
  toValue: string | null;
  createdAt: Date;
}
