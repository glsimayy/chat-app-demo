import { APIClient } from "./apiCore";
import {
  mapConversationDetails,
  mapConversationToListItem,
  mapMessage,
} from "./backendAdapters";

const api = new APIClient();

const getUsers = async () => {
  const users: any = await api.get("/users");
  return Array.isArray(users) ? users : users?.items || [];
};

const getConversations = async () => {
  const response: any = await api.get("/conversations");
  return Array.isArray(response) ? response : response?.items || [];
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
  const [users, conversations] = await Promise.all([
    getUsers(),
    getConversations(),
  ]);

  return conversations
    .filter((conversation: any) => conversation.type === "group")
    .map((conversation: any) => mapConversationToListItem(conversation, users));
};

const addContacts = async (contacts: Array<string | number>) => {
  await Promise.all(
    contacts.map((participantId) =>
      api.create("/conversations/direct", { participantId })
    )
  );

  return "Conversation created";
};

const createChannel = (data: any) => {
  return api.create("/conversations/groups", {
    name: data.name,
    participantIds: data.members || data.participantIds || [],
  });
};

const getConversationParticipants = async (
  conversationId: string | number,
) => {
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

const deleteMessage = async (
  userId: number | string,
  messageId: number | string
) => {
  await api.delete(`/conversations/${userId}/messages/${messageId}`);
  return "Message deleted";
};

const forwardMessage = async (data: any) => {
  const content = data?.forwardedMessage?.text || data?.message || "";
  await Promise.all(
    (data.contacts || []).map((conversationId: string | number) =>
      api.create(`/conversations/${conversationId}/messages`, {
        content,
        clientMessageId: crypto.randomUUID(),
      })
    )
  );

  return "Message forwarded";
};

const deleteUserMessages = (_userId?: string | number) =>
  Promise.resolve("Not supported yet");

const getChannelDetails = getChatUserDetails;

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
  _imageId?: string | number
) => Promise.resolve("Image deleted");

export {
  getUsers,
  getFavourites,
  getDirectMessages,
  getChannels,
  addContacts,
  createChannel,
  getConversationParticipants,
  addConversationParticipant,
  removeConversationParticipant,
  getChatUserDetails,
  getChatUserConversations,
  sendMessage,
  receiveMessage,
  readMessage,
  receiveMessageFromUser,
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
