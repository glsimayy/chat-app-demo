import { PublicUser } from "../users/user.types";
import { ContactInvitationStatus } from "./contact-invitation-status.enum";

export interface ContactInvitationRecord {
  id: string;
  senderId: string;
  recipientId: string;
  message: string | null;
  status: ContactInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
  respondedAt: Date | null;
}

export interface ContactInvitationView extends ContactInvitationRecord {
  sender: PublicUser;
  recipient: PublicUser;
}
