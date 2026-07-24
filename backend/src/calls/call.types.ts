import { CallStatus } from "./call-status.enum";

export interface CallRecord {
  id: string;
  conversationId: string;
  callerId: string;
  recipientId: string;
  status: CallStatus;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  endedReason: string | null;
  endedById: string | null;
}

export interface CreateCallRecordInput {
  id: string;
  conversationId: string;
  callerId: string;
  recipientId: string;
  startedAt: Date;
}
