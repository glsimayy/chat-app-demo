import { APIClient } from "./apiCore";

const api = new APIClient();

export type CatchUpWindow = "2h" | "24h" | "7d";
export type CatchUpMomentKind = "decision" | "action" | "highlight";

export interface CatchUpParticipant {
  userId: string;
  username: string;
  messageCount: number;
}

export interface CatchUpTopic {
  label: string;
  count: number;
}

export interface CatchUpMoment {
  messageId: string;
  kind: CatchUpMomentKind;
  senderId: string;
  senderUsername: string;
  preview: string;
  createdAt: string;
  replyCount: number;
  attachmentCount: number;
}

export interface ConversationCatchUp {
  conversationId: string;
  window: CatchUpWindow;
  startAt: string;
  endAt: string;
  generatedAt: string;
  summary: string;
  messageCount: number;
  participantCount: number;
  replyCount: number;
  attachmentCount: number;
  systemEventCount: number;
  analyzedMessageCount: number;
  truncated: boolean;
  activeParticipants: CatchUpParticipant[];
  topics: CatchUpTopic[];
  keyMoments: CatchUpMoment[];
}

export const getConversationCatchUp = (
  conversationId: string | number,
  window: CatchUpWindow,
) =>
  api.get(`/conversations/${conversationId}/messages/catch-up`, {
    params: { window },
  }) as unknown as Promise<ConversationCatchUp>;
