import { UserRole } from "./user-role.enum";

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export type PublicUser = Omit<UserRecord, "passwordHash">;
