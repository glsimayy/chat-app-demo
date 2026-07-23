import { UserRole } from "./user-role.enum";

export interface UserRecord {
  id: string;
  automationId: number | null;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  about: string | null;
  location: string | null;
  profileImage: string | null;
  createdAt: Date;
}

export type PublicUser = Omit<UserRecord, "passwordHash"> & {
  isBot: boolean;
};
