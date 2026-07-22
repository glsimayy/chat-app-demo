import { APIClient } from "./apiCore";

const api = new APIClient();

export type SupportTicketPriority = "low" | "medium" | "high";
export type SupportTicketStatus =
  "open" | "in_progress" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  requesterId: string;
  subject: string;
  message: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  requester: {
    id: string;
    username: string;
    email: string;
  } | null;
}

interface TicketListResponse {
  items: SupportTicket[];
  pageInfo: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export const createSupportTicket = (data: {
  subject: string;
  message: string;
  priority: SupportTicketPriority;
}) => api.create("/tickets", data) as unknown as Promise<SupportTicket>;

export const getSupportTickets = (
  params: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    search?: string;
  } = {},
) => api.get("/tickets", { params }) as unknown as Promise<TicketListResponse>;

export const updateSupportTicket = (
  ticketId: string,
  data: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    adminNote?: string;
  },
) =>
  api.patch(`/tickets/${ticketId}`, data) as unknown as Promise<SupportTicket>;
