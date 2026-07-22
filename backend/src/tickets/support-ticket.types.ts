import { SupportTicketPriority } from "./support-ticket-priority.enum";
import { SupportTicketStatus } from "./support-ticket-status.enum";

export interface SupportTicketRecord {
  id: string;
  requesterId: string;
  subject: string;
  message: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}
