import { APIClient } from "./apiCore";
import {
  mapConversationDetails,
  mapConversationToListItem,
  mapMessage,
} from "./backendAdapters";

const api = new APIClient();

let usersCache: { data: Array<any>; expiresAt: number } | null = null;
let usersRequest: Promise<Array<any>> | null = null;
let conversationsRequest: Promise<Array<any>> | null = null;

const getUsers = async () => {
  if (usersCache && usersCache.expiresAt > Date.now()) {
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

const getFavourites = () => Promise.resolve([]);

const getDirectMessages = async () => {
  const [users, conversations] = await Promise.all([
    getUsers(),
    getConversations(),
  ]);

  return conversations
    .filter((conversation: any) => conversation.type === "direct")
    .map((conversation: any) => mapConversationToListItem(conversation, users));
};

const getChannels = async () => {
  const conversations = await getConversations();

  return conversations
    .filter((conversation: any) => conversation.type === "group")
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
  name: string,
) => api.patch(`/conversations/${conversationId}`, { name });

const transferConversationOwner = (
  conversationId: string | number,
  userId: string,
) => api.patch(`/conversations/${conversationId}/owner`, { userId });

const leaveConversation = (conversationId: string | number) =>
  api.create(`/conversations/${conversationId}/leave`);

const getChatUserDetails = async (id: string | number) => {
  const [users, conversation] = await Promise.all([
    getUsers(),
    findConversation(id),
  ]);

  return conversation
    ? mapConversationDetails(conversation, users)
    : { id, firstName: "Conversation", lastName: "" };
};

const getChatUserConversations = async (id: string | number) => {
  const response: any = await api.get(`/conversations/${id}/messages`, {
    params: { limit: 100 },
  });
  const messages = Array.isArray(response) ? response : response?.items || [];

  return {
    conversationId: id,
    userId: id,
    messages: messages.map(mapMessage),
  };
};

const sendMessage = (data: any) => {
  const conversationId = data?.meta?.receiver;
  const content =
    data?.text ||
    (data?.attachments?.length ? "[attachment]" : "") ||
    (data?.image?.length || data?.newimage?.length ? "[image]" : "");

  return api.create(`/conversations/${conversationId}/messages`, {
    content,
    clientMessageId: data?.clientMessageId,
  });
};

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
        clientMessageId: crypto.randomUUID(),
      }),
    ),
  );

  return "Message forwarded";
};

const deleteUserMessages = (_userId?: string | number) =>
  Promise.resolve("Not supported yet");

const getChannelDetails = async (id: string | number) => {
  const conversation = await findConversation(id);

  return conversation
    ? mapConversationDetails(conversation)
    : { id, name: "Conversation", isChannel: true, members: [] };
};

const toggleFavouriteContact = (_id?: string | number) =>
  Promise.resolve("Updated");

const getArchiveContact = () => Promise.resolve([]);

const toggleArchiveContact = (_id?: string | number) =>
  Promise.resolve("Updated");

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
  transferConversationOwner,
  leaveConversation,
  getChatUserDetails,
  getChatUserConversations,
  sendMessage,
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
