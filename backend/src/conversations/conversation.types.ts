import { ConversationType } from "./conversation-type.enum";
import { ConversationStatus } from "./conversation-status.enum";
import { MessageType } from "./message-type.enum";
import { ParticipantRole } from "./participant-role.enum";

export interface ConversationParticipant {
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  lastReadAt: Date | null;
  leftAt: Date | null;
}

export interface ConversationRecord {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  createdBy: string;
  externalRef?: string | null;
  isBotManaged: boolean;
  sourceName: string | null;
  memberCanSendMessages: boolean;
  membersCanLeave: boolean;
  status: ConversationStatus;
  parentConversationId: string | null;
  participants: ConversationParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalGroupConversationResult extends ConversationRecord {
  created: boolean;
  reused: boolean;
}

export interface MessageRecord {
  id: string;
  clientMessageId: string | null;
  conversationId: string;
  senderId: string | null;
  replyToMessageId: string | null;
  content: string;
  messageType: MessageType;
  isForwarded: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
  attachments?: MessageAttachmentRecord[];
}

export interface MessageAttachmentRecord {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
}

export interface UploadedMessageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
