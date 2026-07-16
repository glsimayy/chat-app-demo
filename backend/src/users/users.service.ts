import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { UserRole } from "./user-role.enum";
import { PublicUser, UserRecord } from "./user.types";

interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}

const DEVELOPMENT_USERS = [
  {
    username: "admin",
    email: "admin@ello.local",
    password: "Admin123!",
    role: UserRole.Admin,
  },
  {
    username: "user1",
    email: "user1@ello.local",
    password: "User123!",
    role: UserRole.User,
  },
  {
    username: "user2",
    email: "user2@ello.local",
    password: "User123!",
    role: UserRole.User,
  },
] as const;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly users = new Map<string, UserRecord>();
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    if (
      this.configService.get<string>("NODE_ENV", "development") !==
      "development"
    ) {
      return;
    }

    for (const demoUser of DEVELOPMENT_USERS) {
      const passwordHash = await bcrypt.hash(demoUser.password, 10);
      await this.create({
        username: demoUser.username,
        email: demoUser.email,
        passwordHash,
        role: demoUser.role,
      });
    }

    this.logger.log(`Seeded ${DEVELOPMENT_USERS.length} development users`);
  }

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
      role: input.role ?? this.getDefaultRole(),
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return this.toPublicUser(user);
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.findByEmailSync(email.toLowerCase());
  }

  async findById(id: string): Promise<PublicUser | undefined> {
    return this.findByIdSync(id);
  }

  async findRecordById(id: string): Promise<UserRecord | undefined> {
    return this.users.get(id);
  }

  async updatePasswordHash(id: string, passwordHash: string) {
    const user = this.users.get(id);

    if (!user) {
      return undefined;
    }

    user.passwordHash = passwordHash;

    return this.toPublicUser(user);
  }

  findByIdSync(id: string): PublicUser | undefined {
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

  clearAll() {
    const deletedUsers = this.users.size;
    this.users.clear();

    return { deletedUsers };
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

  private getDefaultRole() {
    const isLocalFirstUser =
      this.users.size === 0 &&
      this.configService.get<string>("NODE_ENV", "development") !==
        "production";

    return isLocalFirstUser ? UserRole.Admin : UserRole.User;
  }
}
