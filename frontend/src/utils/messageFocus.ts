export interface PendingMessageFocus {
  conversationId: string;
  messageId: string;
  conversationType: "direct" | "group" | "management";
  parentConversationId: string | null;
}

const MESSAGE_FOCUS_KEY = "ello:pending-message-focus";

export const savePendingMessageFocus = (target: PendingMessageFocus) => {
  window.sessionStorage.setItem(MESSAGE_FOCUS_KEY, JSON.stringify(target));
};

export const readPendingMessageFocus = (): PendingMessageFocus | null => {
  const stored = window.sessionStorage.getItem(MESSAGE_FOCUS_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as PendingMessageFocus;
  } catch {
    window.sessionStorage.removeItem(MESSAGE_FOCUS_KEY);
    return null;
  }
};

export const clearPendingMessageFocus = () => {
  window.sessionStorage.removeItem(MESSAGE_FOCUS_KEY);
};
