import { STATUS_TYPES } from "../constants";

const splitDisplayName = (value?: string | null) => {
  const fallback = value?.trim() || "User";
  const parts = fallback.split(/[\s._-]+/).filter(Boolean);
  const firstName = parts[0] || fallback;
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
};

export const getCurrentAuthUser = () => {
  const rawUser = localStorage.getItem("authUser");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
};

export const getCurrentUserId = () => {
  const user = getCurrentAuthUser();
  return user?.id || user?.uid || null;
};

export const mapBackendUser = (user: any) => {
  const username = user?.username || user?.email || "User";
  const { firstName, lastName } = splitDisplayName(username);

  return {
    ...user,
    uid: user?.id || user?.uid,
    firstName,
    lastName,
    username,
    status: STATUS_TYPES.OFFLINE,
    profileImage: user?.profileImage,
  };
};

export const mapAuthResponse = (response: any) => {
  const payload = response?.data?.accessToken ? response.data : response;
  const user = payload?.user || payload;
  const token = payload?.accessToken || user?.accessToken || user?.token;

  return {
    ...mapBackendUser(user),
    status: STATUS_TYPES.ACTIVE,
    accessToken: token,
    token,
  };
};

export const mapContact = (user: any) => {
  const mappedUser = mapBackendUser(user);

  return {
    ...mappedUser,
    about: mappedUser.email,
    channels: [],
  };
};

export const mapConversationToListItem = (
  conversation: any,
  users: Array<any> = [],
) => {
  const currentUserId = getCurrentUserId();
  const isChannel = conversation?.type === "group";
  const otherParticipant = (conversation?.participants || []).find(
    (participant: any) =>
      participant.userId !== currentUserId && !participant.leftAt,
  );
  const otherUser = users.find(
    (user: any) => user.id === otherParticipant?.userId,
  );
  const displayUser = otherUser || {
    id: conversation?.id,
    username: conversation?.name || "Conversation",
  };
  const mappedUser = mapBackendUser(displayUser);

  if (isChannel) {
    return {
      id: conversation.id,
      name: conversation.name || "Group",
      members: conversation.participants || [],
      automated: Boolean(conversation.isBotManaged || conversation.externalRef),
      isBotManaged: Boolean(conversation.isBotManaged),
      externalRef: conversation.externalRef || null,
      description: conversation.description || null,
      sourceName: conversation.sourceName || null,
      memberCanSendMessages: Boolean(conversation.memberCanSendMessages),
      membersCanLeave: conversation.membersCanLeave !== false,
      status: conversation.status || "active",
      isBookmarked: Boolean(conversation.isBookmarked),
      isArchived: Boolean(conversation.isArchived),
      meta: {
        unRead: conversation.unreadCount || 0,
      },
    };
  }

  return {
    id: conversation.id,
    username: mappedUser.username,
    firstName: mappedUser.firstName,
    lastName: mappedUser.lastName,
    email: mappedUser.email,
    about: mappedUser.about,
    location: mappedUser.location,
    profileImage: mappedUser.profileImage,
    isBot: Boolean(mappedUser.isBot),
    status: STATUS_TYPES.OFFLINE,
    participantId: otherParticipant?.userId,
    isBookmarked: Boolean(conversation.isBookmarked),
    isArchived: Boolean(conversation.isArchived),
    meta: {
      unRead: conversation.unreadCount || 0,
      status: STATUS_TYPES.OFFLINE,
    },
  };
};

export const isBotDirectConversation = (
  conversation: any,
  users: Array<any> = [],
) => {
  if (conversation?.type !== "direct") {
    return false;
  }

  const botUserIds = new Set(
    users.filter(user => Boolean(user.isBot)).map(user => user.id),
  );

  return (conversation?.participants || []).some(
    (participant: any) =>
      !participant.leftAt && botUserIds.has(participant.userId),
  );
};

export const mapConversationDetails = (
  conversation: any,
  users: Array<any> = [],
) => {
  const listItem = mapConversationToListItem(conversation, users);
  const isChannel = conversation?.type === "group";

  return {
    ...listItem,
    isChannel,
    members: conversation?.participants || [],
    participantCount: conversation?.participantCount,
    automated: Boolean(conversation?.isBotManaged || conversation?.externalRef),
    isBotManaged: Boolean(conversation?.isBotManaged),
    externalRef: conversation?.externalRef || null,
    description: conversation?.description || null,
    sourceName: conversation?.sourceName || null,
    memberCanSendMessages: Boolean(conversation?.memberCanSendMessages),
    membersCanLeave: conversation?.membersCanLeave !== false,
    status: isChannel
      ? conversation?.status || "active"
      : listItem.status || STATUS_TYPES.OFFLINE,
    parentConversationId: conversation?.parentConversationId || null,
    isBookmarked: Boolean(conversation?.isBookmarked),
    isArchived: Boolean(conversation?.isArchived),
  };
};

export const mapMessage = (message: any, users: Array<any> = []) => {
  const currentUserId = getCurrentUserId();
  const isDeleted = Boolean(message.deletedAt);
  const sender = users.find((user: any) => user.id === message.senderId);
  const senderData = sender
    ? mapBackendUser(sender)
    : {
        id: "system",
        uid: "system",
        firstName: "System",
        lastName: "",
        username: "System",
        email: "",
        location: "",
        isBot: false,
      };
  const storedAttachments = isDeleted ? [] : message.attachments || [];
  const attachmentPath = (attachmentId: string) =>
    `/conversations/${message.conversationId}/attachments/${attachmentId}`;
  const images = storedAttachments
    .filter((attachment: any) => attachment.mimeType?.startsWith("image/"))
    .map((attachment: any) => ({
      id: attachment.id,
      downloadLink: attachmentPath(attachment.id),
      requiresAuth: true,
      mimeType: attachment.mimeType,
      name: attachment.fileName,
    }));
  const files = storedAttachments
    .filter((attachment: any) => !attachment.mimeType?.startsWith("image/"))
    .map((attachment: any) => ({
      id: attachment.id,
      name: attachment.fileName,
      downloadLink: attachmentPath(attachment.id),
      requiresAuth: true,
      mimeType: attachment.mimeType,
      desc: formatFileSize(attachment.fileSize),
    }));

  return {
    mId: message.id,
    text: isDeleted ? "This message was deleted" : message.content,
    time: message.createdAt || new Date().toISOString(),
    updatedAt: message.updatedAt,
    isEdited: Boolean(message.updatedAt) && !isDeleted,
    isDeleted,
    messageType: message.messageType,
    image: images,
    attachments: files,
    meta: {
      receiver: message.conversationId,
      sender: message.senderId || "system",
      userData: senderData,
      sent: message.senderId === currentUserId,
      received: true,
      read: true,
    },
  };
};

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${Math.max(0, bytes || 0)} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
};
