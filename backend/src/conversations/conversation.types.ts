import { ConversationType } from "./conversation-type.enum";
import { MessageType } from "./message-type.enum";
import { ParticipantRole } from "./participant-role.enum";

export interface ConversationParticipant {
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface ConversationRecord {
  id: string;
  type: ConversationType;
  name: string | null;
  createdBy: string;
  externalRef?: string | null;
  participants: ConversationParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  messageType: MessageType;
  createdAt: Date;
}
