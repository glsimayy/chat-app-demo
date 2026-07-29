import { APIClient } from "./apiCore";

const api = new APIClient();

export type AdminMessageAccessReason =
  | "support_request"
  | "abuse_investigation"
  | "security_incident"
  | "system_test"
  | "other";

export interface AdminIdentity {
  id: string;
  username: string;
  email: string;
}

export interface AdminOverview {
  totals: {
    users: number;
    admins: number;
    conversations: number;
    directConversations: number;
    groupConversations: number;
    managementConversations: number;
    botManagedGroups: number;
    messages: number;
    deletedMessages: number;
    attachments: number;
    attachmentBytes: number;
    calls: number;
    supportTickets: number;
    openSupportTickets: number;
    messageContentAccesses: number;
  };
  activity24h: {
    newUsers: number;
    newConversations: number;
    messages: number;
    attachments: number;
    calls: number;
    supportTickets: number;
    messageContentAccesses: number;
  };
  runtime: {
    uptimeSeconds: number;
    counters: {
      httpRequestsTotal: number;
      httpErrorsTotal: number;
      socketConnectionsTotal: number;
      socketDisconnectsTotal: number;
      socketEventsTotal: number;
      socketErrorsTotal: number;
      messagesCreatedTotal: number;
    };
    gauges: {
      activeSockets: number;
      averageHttpDurationMs: number;
    };
    socketEventsByName: Record<string, number>;
    collectedAt: string;
  };
  collectedAt: string;
}

export interface AdminMessageMetadata {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  messageType: "user" | "system";
  isForwarded: boolean;
  sender: AdminIdentity | null;
  conversation: {
    id: string;
    type: "direct" | "group" | "management";
    name: string | null;
    participantCount: number;
    recipients: AdminIdentity[];
  };
  attachmentCount: number;
  attachmentBytes: number;
  contentState: "masked" | "deleted";
}

export interface AdminRevealedAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface AdminMessageAccessAudit {
  id: string;
  reason: AdminMessageAccessReason;
  justification: string;
  createdAt: string;
  admin: AdminIdentity | null;
  message: {
    id: string;
    createdAt: string | null;
    sender: AdminIdentity | null;
    conversation: {
      id: string;
      type: "direct" | "group" | "management";
      name: string | null;
    } | null;
  };
}

interface PageInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface AdminMessageList {
  items: AdminMessageMetadata[];
  pageInfo: PageInfo;
}

export interface AdminAuditList {
  items: AdminMessageAccessAudit[];
  pageInfo: PageInfo;
}

export const getAdminOverview = () =>
  api.get("/admin/overview") as unknown as Promise<AdminOverview>;

export const getAdminMessages = (
  params: {
    search?: string;
    conversationType?: string;
    hasAttachments?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) =>
  api.get("/admin/messages", {
    params,
  }) as unknown as Promise<AdminMessageList>;

export const revealAdminMessage = (
  messageId: string,
  data: {
    reason: AdminMessageAccessReason;
    justification: string;
  },
) =>
  api.create(
    `/admin/messages/${messageId}/reveal`,
    data,
  ) as unknown as Promise<{
    auditId: string;
    messageId: string;
    content: string;
    attachments: AdminRevealedAttachment[];
    revealedAt: string;
  }>;

export const getAdminAttachmentBlob = (
  messageId: string,
  attachmentId: string,
  auditId: string,
) =>
  api.getBlob(
    `/admin/messages/${messageId}/attachments/${attachmentId}?auditId=${encodeURIComponent(
      auditId,
    )}`,
  );

export const getAdminMessageAccessAudits = (
  params: { limit?: number; offset?: number } = {},
) =>
  api.get("/admin/message-access-audits", {
    params,
  }) as unknown as Promise<AdminAuditList>;
