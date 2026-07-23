const SHARED_CONTACT_PREFIX = "ello://contact/";

export const createSharedContactMessage = (userId: string | number) =>
  `${SHARED_CONTACT_PREFIX}${encodeURIComponent(String(userId))}`;

export const parseSharedContactMessage = (content?: string | null) => {
  if (!content?.startsWith(SHARED_CONTACT_PREFIX)) {
    return null;
  }

  const encodedUserId = content.slice(SHARED_CONTACT_PREFIX.length);
  if (!encodedUserId || encodedUserId.includes("\n")) {
    return null;
  }

  try {
    return decodeURIComponent(encodedUserId);
  } catch {
    return null;
  }
};
