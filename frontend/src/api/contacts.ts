import { APIClient } from "./apiCore";
import { getCurrentUserId, mapContact } from "./backendAdapters";

const api = new APIClient();

const getContacts = async (_filters?: object) => {
  const [users, conversationResponse]: any[] = await Promise.all([
    api.get("/users"),
    api.get("/conversations", {
      params: { type: "direct", limit: 100 },
    }),
  ]);
  const currentUserId = getCurrentUserId();
  const userList = Array.isArray(users) ? users : users?.items || [];
  const conversations = Array.isArray(conversationResponse)
    ? conversationResponse
    : conversationResponse?.items || [];
  const contactUserIds = new Set(
    conversations.flatMap((conversation: any) =>
      (conversation.participants || [])
        .filter(
          (participant: any) =>
            !participant.leftAt && participant.userId !== currentUserId,
        )
        .map((participant: any) => participant.userId),
    ),
  );

  return userList
    .filter(
      (user: any) =>
        user.id !== currentUserId &&
        !user.isBot &&
        contactUserIds.has(user.id),
    )
    .map(mapContact);
};

export interface ContactInvitation {
  id: string;
  senderId: string;
  recipientId: string;
  message: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  sender: ReturnType<typeof mapContact>;
  recipient: ReturnType<typeof mapContact>;
}

const inviteContact = async (data: { email: string; message?: string }) => {
  await api.create("/contact-invitations", data);
  return "Invitation sent";
};

const getUserProfile = (userId: string) =>
  api.get(`/users/${userId}`).then(mapContact);

const getContactInvitations = () =>
  api.get("/contact-invitations").then((invitations: any) =>
    (Array.isArray(invitations) ? invitations : []).map(invitation => ({
      ...invitation,
      sender: mapContact(invitation.sender),
      recipient: mapContact(invitation.recipient),
    })),
  ) as Promise<ContactInvitation[]>;

const respondToContactInvitation = (
  invitationId: string,
  status: "accepted" | "declined",
) => api.patch(`/contact-invitations/${invitationId}`, { status });

export {
  getContacts,
  getUserProfile,
  getContactInvitations,
  inviteContact,
  respondToContactInvitation,
};
