import {
  ConversationRecord,
  MessageRecord,
} from "../conversations/conversation.types";
import { PublicUser } from "../users/user.types";

export interface MessageBookmarkRecord {
  userId: string;
  messageId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageBookmarkView extends MessageBookmarkRecord {
  id: string;
  message: MessageRecord;
  conversation: Pick<
    ConversationRecord,
    "id" | "name" | "type" | "parentConversationId"
  >;
  sender: PublicUser | null;
}
