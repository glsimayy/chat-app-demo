import { APIClient } from "./apiCore";
import { mapContact } from "./backendAdapters";

const api = new APIClient();

const getContacts = async (_filters?: object) => {
  const users: any = await api.get("/conversations/contacts");
  const userList = Array.isArray(users) ? users : users?.items || [];

  return userList.map(mapContact);
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
