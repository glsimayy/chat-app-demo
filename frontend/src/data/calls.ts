export type CallHistoryStatus =
  | "ringing"
  | "active"
  | "completed"
  | "missed"
  | "declined"
  | "failed";

export interface CallItem {
  callId: string;
  conversationId: string;
  peerId: string;
  firstName: string;
  lastName: string;
  profileImage?: string | null;
  callDuration: string;
  direction: "incoming" | "outgoing";
  callDate: string;
  status: CallHistoryStatus;
}
