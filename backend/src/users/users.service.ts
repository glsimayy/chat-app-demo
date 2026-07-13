import { ConflictException, Injectable } from "@nestjs/common";
import { UserRole } from "./user-role.enum";
import { PublicUser, UserRecord } from "./user.types";

interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  private readonly users = new Map<string, UserRecord>();

  async create(input: CreateUserInput): Promise<PublicUser> {
    const email = input.email.toLowerCase();
    const username = input.username.trim();

    if (this.findByEmailSync(email)) {
      throw new ConflictException("Email already exists");
    }

    if (this.findByUsernameSync(username)) {
      throw new ConflictException("Username already exists");
    }

    const user: UserRecord = {
      id: crypto.randomUUID(),
      username,
      email,
      passwordHash: input.passwordHash,
      role:
        input.role ?? (this.users.size === 0 ? UserRole.Admin : UserRole.User),
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return this.toPublicUser(user);
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.findByEmailSync(email.toLowerCase());
  }

  async findById(id: string): Promise<PublicUser | undefined> {
    const user = this.users.get(id);
    return user ? this.toPublicUser(user) : undefined;
  }

  async findAll(search?: string): Promise<PublicUser[]> {
    const normalizedSearch = search?.trim().toLowerCase();
    const users = Array.from(this.users.values());

    return users
      .filter((user) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          user.username.toLowerCase().includes(normalizedSearch) ||
          user.email.toLowerCase().includes(normalizedSearch)
        );
      })
      .map((user) => this.toPublicUser(user));
  }

  toPublicUser(user: UserRecord): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  private findByEmailSync(email: string) {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  private findByUsernameSync(username: string) {
    const normalizedUsername = username.toLowerCase();
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === normalizedUsername,
    );
  }
}
