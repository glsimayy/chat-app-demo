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
    status: STATUS_TYPES.ACTIVE,
    profileImage: user?.profileImage,
  };
};

export const mapAuthResponse = (response: any) => {
  const payload = response?.data?.accessToken ? response.data : response;
  const user = payload?.user || payload;
  const token = payload?.accessToken || user?.accessToken || user?.token;

  return {
    ...mapBackendUser(user),
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
    (participant: any) => participant.userId !== currentUserId && !participant.leftAt,
  );
  const otherUser = users.find((user: any) => user.id === otherParticipant?.userId);
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
      meta: {
        unRead: conversation.unreadCount || 0,
      },
    };
  }

  return {
    id: conversation.id,
    firstName: mappedUser.firstName,
    lastName: mappedUser.lastName,
    email: mappedUser.email,
    status: STATUS_TYPES.ACTIVE,
    participantId: otherParticipant?.userId,
    meta: {
      unRead: conversation.unreadCount || 0,
      status: STATUS_TYPES.ACTIVE,
    },
  };
};

export const mapConversationDetails = (
  conversation: any,
  users: Array<any> = [],
) => {
  const listItem = mapConversationToListItem(conversation, users);

  return {
    ...listItem,
    isChannel: conversation?.type === "group",
    members: conversation?.participants || [],
    participantCount: conversation?.participantCount,
  };
};

export const mapMessage = (message: any) => {
  const currentUserId = getCurrentUserId();
  const isDeleted = Boolean(message.deletedAt);

  return {
    mId: message.id,
    text: isDeleted ? "This message was deleted" : message.content,
    time: message.createdAt || new Date().toISOString(),
    updatedAt: message.updatedAt,
    isEdited: Boolean(message.updatedAt) && !isDeleted,
    isDeleted,
    meta: {
      receiver: message.conversationId,
      sender: message.senderId || "system",
      sent: message.senderId === currentUserId,
      received: true,
      read: true,
    },
  };
};
