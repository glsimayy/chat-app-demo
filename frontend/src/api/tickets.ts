import { APIClient } from "./apiCore";

const api = new APIClient();

export type SupportTicketPriority = "low" | "medium" | "high";
export type SupportTicketStatus =
  "open" | "in_progress" | "resolved" | "closed";
export type SupportTicketAssignment = "all" | "mine" | "unassigned";
export type SupportTicketActivityAction =
  | "created"
  | "assigned"
  | "unassigned"
  | "transferred"
  | "status_changed"
  | "priority_changed"
  | "note_updated";

export interface SupportTicketUser {
  id: string;
  username: string;
  email: string;
}

export interface SupportTicketActivity {
  id: string;
  ticketId: string;
  actorId: string | null;
  action: SupportTicketActivityAction;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  actor: SupportTicketUser | null;
}

export interface SupportTicket {
  id: string;
  requesterId: string;
  assignedAdminId: string | null;
  subject: string;
  message: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  adminNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  requester: SupportTicketUser | null;
  assignedAdmin: SupportTicketUser | null;
  activities: SupportTicketActivity[];
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
    assignment?: SupportTicketAssignment;
  } = {},
) => api.get("/tickets", { params }) as unknown as Promise<TicketListResponse>;

export const getSupportTicket = (ticketId: string) =>
  api.get(`/tickets/${ticketId}`) as unknown as Promise<SupportTicket>;

export const claimSupportTicket = (ticketId: string, expectedVersion: number) =>
  api.create(`/tickets/${ticketId}/claim`, {
    expectedVersion,
  }) as unknown as Promise<SupportTicket>;

export const assignSupportTicket = (
  ticketId: string,
  adminId: string | null,
  expectedVersion: number,
) =>
  api.patch(`/tickets/${ticketId}/assignee`, {
    adminId,
    expectedVersion,
  }) as unknown as Promise<SupportTicket>;

export const updateSupportTicket = (
  ticketId: string,
  data: {
    expectedVersion: number;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    adminNote?: string;
  },
) =>
  api.patch(`/tickets/${ticketId}`, data) as unknown as Promise<SupportTicket>;
