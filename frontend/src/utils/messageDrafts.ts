const MESSAGE_DRAFT_PREFIX = "ello:message-draft:";

const getStorageKey = (scope: string) =>
  scope.trim() ? `${MESSAGE_DRAFT_PREFIX}${scope.trim()}` : null;

export const readMessageDraft = (scope: string) => {
  const key = getStorageKey(scope);
  if (!key) {
    return "";
  }

  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

export const writeMessageDraft = (scope: string, value: string) => {
  const key = getStorageKey(scope);
  if (!key) {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Draft persistence must never block composing or sending a message.
  }
};

export const clearMessageDraft = (scope: string) => {
  writeMessageDraft(scope, "");
};
