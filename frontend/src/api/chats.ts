import { APIClient } from "./apiCore";
import {
  isBotDirectConversation,
  mapConversationDetails,
  mapConversationToListItem,
  mapMessage,
} from "./backendAdapters";
import { createClientMessageId } from "../utils/clientMessageId";

const api = new APIClient();

let usersCache: { data: Array<any>; expiresAt: number } | null = null;
let usersRequest: Promise<Array<any>> | null = null;
let conversationsRequest: Promise<Array<any>> | null = null;

const getUsers = async (forceRefresh = false) => {
  if (!forceRefresh && usersCache && usersCache.expiresAt > Date.now()) {
    return usersCache.data;
  }

  if (usersRequest) {
    return usersRequest;
  }

  usersRequest = api.get("/users").then((users: any) => {
    const data = Array.isArray(users) ? users : users?.items || [];
    usersCache = { data, expiresAt: Date.now() + 5_000 };
    return data;
  });

  try {
    return await usersRequest;
  } finally {
    usersRequest = null;
  }
};

const getConversations = async () => {
  if (conversationsRequest) {
    return conversationsRequest;
  }

  conversationsRequest = api
    .get("/conversations")
    .then((response: any) =>
      Array.isArray(response) ? response : response?.items || [],
    );

  try {
    return await conversationsRequest;
  } finally {
    conversationsRequest = null;
  }
};

const findConversation = async (id: string | number) => {
  const conversations = await getConversations();
  return conversations.find((conversation: any) => conversation.id === id);
};

const getFavourites = async () => {
  const [users, conversations] = await Promise.all([
    getUsers(),
    getConversations(),
  ]);

  return conversations
    .filter(
      (conversation: any) =>
        conversation.type === "direct" &&
        conversation.isBookmarked &&
        !conversation.isArchived &&
        !isBotDirectConversation(conversation, users),
    )
    .map((conversation: any) => mapConversationToListItem(conversation, users));
};

const getDirectMessages = async () => {
  const [users, conversations] = await Promise.all([
    getUsers(),
    getConversations(),
  ]);

  return conversations
    .filter(
      (conversation: any) =>
        conversation.type === "direct" &&
        !conversation.isArchived &&
        !isBotDirectConversation(conversation, users),
    )
    .map((conversation: any) => mapConversationToListItem(conversation, users));
};

const getChannels = async () => {
  const conversations = await getConversations();

  return conversations
    .filter(
      (conversation: any) =>
        conversation.type === "group" && !conversation.isArchived,
    )
    .map((conversation: any) => mapConversationToListItem(conversation));
};

const addContacts = async (contacts: Array<string | number>) => {
  await Promise.all(
    contacts.map(participantId =>
      api.create("/conversations/direct", { participantId }),
    ),
  );

  return "Conversation created";
};

const createDirectConversation = (participantId: string | number) =>
  api.create("/conversations/direct", { participantId });

const createChannel = (data: any) => {
  return api.create("/conversations/groups", {
    name: data.name,
    participantIds: data.members || data.participantIds || [],
    managerIds: data.managerIds || [],
    description: data.description,
    memberCanSendMessages: data.memberCanSendMessages ?? false,
    membersCanLeave: data.membersCanLeave ?? true,
  });
};

const getConversationParticipants = async (conversationId: string | number) => {
  const participants: any = await api.get(
    `/conversations/${conversationId}/participants`,
  );

  return Array.isArray(participants) ? participants : [];
};

const addConversationParticipant = (
  conversationId: string | number,
  userId: string,
) => api.create(`/conversations/${conversationId}/participants`, { userId });

const removeConversationParticipant = (
  conversationId: string | number,
  userId: string,
) => api.delete(`/conversations/${conversationId}/participants/${userId}`);

const updateGroupConversation = (
  conversationId: string | number,
  updates: Record<string, unknown> | string,
) =>
  api.patch(
    `/conversations/${conversationId}`,
    typeof updates === "string" ? { name: updates } : updates,
  );

const updateConversationParticipantRole = (
  conversationId: string | number,
  userId: string,
  role: "manager" | "member",
) =>
  api.patch(`/conversations/${conversationId}/participants/${userId}/role`, {
    role,
  });

const getManagementConversation = (conversationId: string | number) =>
  api.get(`/conversations/${conversationId}/management`);

const transferConversationOwner = (
  conversationId: string | number,
  userId: string,
) => api.patch(`/conversations/${conversationId}/owner`, { userId });

const leaveConversation = (conversationId: string | number) =>
  api.create(`/conversations/${conversationId}/leave`);

const getChatUserDetails = async (id: string | number) => {
  const [users, conversation] = await Promise.all([
    getUsers(true),
    findConversation(id),
  ]);

  return conversation
    ? mapConversationDetails(conversation, users)
    : { id, firstName: "Conversation", lastName: "" };
};

const getChatUserConversations = async (id: string | number) => {
  const [response, users]: [any, Array<any>] = await Promise.all([
    api.get(`/conversations/${id}/messages`, {
      params: { limit: 100 },
    }),
    getUsers(true),
  ]);
  const messages = Array.isArray(response) ? response : response?.items || [];

  return {
    conversationId: id,
    userId: id,
    messages: messages.map((message: any) => mapMessage(message, users)),
  };
};

const searchConversationMessages = async (
  conversationId: string | number,
  query: string,
) => {
  const [response, users]: [any, Array<any>] = await Promise.all([
    api.get(`/conversations/${conversationId}/messages/search`, {
      params: { q: query, limit: 50 },
    }),
    getUsers(true),
  ]);
  const messages = Array.isArray(response) ? response : response?.items || [];

  return messages.map((message: any) => mapMessage(message, users));
};

const sendMessage = (data: any) => {
  const conversationId = data?.meta?.receiver;
  const content = data?.text || "";

  if (data?.files?.length) {
    return api.createWithFile(
      `/conversations/${conversationId}/messages/attachments`,
      {
        content,
        clientMessageId: data?.clientMessageId,
        files: data.files,
      },
    );
  }

  return api.create(`/conversations/${conversationId}/messages`, {
    content,
    clientMessageId: data?.clientMessageId,
  });
};

const getAttachmentBlob = (downloadPath: string) => api.getBlob(downloadPath);

const receiveMessage = (id: string | number) => getChatUserConversations(id);

const readMessage = async (id: string | number) => {
  await api.patch(`/conversations/${id}/read`);
  return getChatUserConversations(id);
};

const receiveMessageFromUser = (id: string | number) =>
  getChatUserConversations(id);

const updateMessage = (
  conversationId: number | string,
  messageId: number | string,
  content: string,
) =>
  api.patch(`/conversations/${conversationId}/messages/${messageId}`, {
    content,
  });

const deleteMessage = async (
  conversationId: number | string,
  messageId: number | string,
) => {
  await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
  return "Message deleted";
};

const forwardMessage = async (data: any) => {
  const content = data?.forwardedMessage?.text || data?.message || "";
  await Promise.all(
    (data.contacts || []).map((conversationId: string | number) =>
      api.create(`/conversations/${conversationId}/messages`, {
        content,
        clientMessageId: createClientMessageId(),
      }),
    ),
  );

  return "Message forwarded";
};

const deleteUserMessages = async (conversationId?: string | number) => {
  if (!conversationId) {
    throw new Error("Conversation is required");
  }

  await api.delete(`/conversations/${conversationId}`);
  return "Conversation deleted";
};

const getChannelDetails = async (id: string | number) => {
  const conversation = await findConversation(id);

  return conversation
    ? mapConversationDetails(conversation)
    : { id, name: "Conversation", isChannel: true, members: [] };
};

const toggleFavouriteContact = async (id?: string | number) => {
  if (!id) {
    throw new Error("Conversation is required");
  }

  const response: any = await api.patch(`/conversations/${id}/bookmark`);
  return response?.isBookmarked
    ? "Conversation bookmarked"
    : "Conversation bookmark removed";
};

const getArchiveContact = async () => {
  const [users, conversations] = await Promise.all([
    getUsers(),
    getConversations(),
  ]);

  return conversations
    .filter((conversation: any) => conversation.isArchived)
    .filter(
      (conversation: any) => !isBotDirectConversation(conversation, users),
    )
    .map((conversation: any) => mapConversationToListItem(conversation, users));
};

const toggleArchiveContact = async (id?: string | number) => {
  if (!id) {
    throw new Error("Conversation is required");
  }

  const response: any = await api.patch(`/conversations/${id}/archive`);
  return response?.isArchived
    ? "Conversation archived"
    : "Conversation restored";
};

const readConversation = async (id: string | number) => {
  await api.patch(`/conversations/${id}/read`);
  return "Conversation read";
};

const deleteImage = (
  _userId?: string | number,
  _messageId?: string | number,
  _imageId?: string | number,
) => Promise.resolve("Image deleted");

export {
  getUsers,
  getFavourites,
  getDirectMessages,
  getChannels,
  addContacts,
  createDirectConversation,
  createChannel,
  getConversationParticipants,
  addConversationParticipant,
  removeConversationParticipant,
  updateGroupConversation,
  updateConversationParticipantRole,
  getManagementConversation,
  transferConversationOwner,
  leaveConversation,
  getChatUserDetails,
  getChatUserConversations,
  searchConversationMessages,
  sendMessage,
  getAttachmentBlob,
  receiveMessage,
  readMessage,
  receiveMessageFromUser,
  updateMessage,
  deleteMessage,
  forwardMessage,
  deleteUserMessages,
  getChannelDetails,
  toggleFavouriteContact,
  getArchiveContact,
  toggleArchiveContact,
  readConversation,
  deleteImage,
};
