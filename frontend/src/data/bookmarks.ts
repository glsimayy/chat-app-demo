export interface BookMarkTypes {
  id: string;
  userId: string;
  messageId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  message: {
    id: string;
    conversationId: string;
    senderId: string | null;
    content: string;
    createdAt: string;
    messageType: "user" | "system";
  };
  conversation: {
    id: string;
    name: string | null;
    type: "direct" | "group" | "management";
    parentConversationId: string | null;
  };
  sender: {
    id: string;
    username: string;
    email: string;
  } | null;
}
