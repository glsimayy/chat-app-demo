import { APIClient } from "./apiCore";
import { getCurrentUserId, mapContact } from "./backendAdapters";

const api = new APIClient();

const getContacts = (filters?: object) => {
  return api.get("/users", filters).then((users: any) => {
    const currentUserId = getCurrentUserId();
    const userList = Array.isArray(users) ? users : users?.items || [];

    return userList
      .filter((user: any) => user.id !== currentUserId && !user.isBot)
      .map(mapContact);
  });
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
