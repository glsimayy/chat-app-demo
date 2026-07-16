import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { UserRole } from "./user-role.enum";
import { UsersService } from "./users.service";

function createConfigService(nodeEnv: string, demoUsersEnabled?: string) {
  return {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === "NODE_ENV") {
        return nodeEnv;
      }

      if (key === "DEMO_USERS_ENABLED") {
        return demoUsersEnabled ?? fallback;
      }

      return fallback;
    }),
  } as unknown as ConfigService;
}

describe("UsersService development users", () => {
  it("seeds one admin and two users in development", async () => {
    const service = new UsersService(createConfigService("development"));

    await service.onModuleInit();

    const users = await service.findAll();
    expect(users).toHaveLength(3);
    expect(users.map((user) => [user.email, user.role])).toEqual([
      ["admin@ello.local", UserRole.Admin],
      ["user1@ello.local", UserRole.User],
      ["user2@ello.local", UserRole.User],
    ]);

    const admin = await service.findByEmail("admin@ello.local");
    expect(admin).toBeDefined();
    await expect(
      bcrypt.compare("Admin123!", admin?.passwordHash ?? ""),
    ).resolves.toBe(true);
  });

  it("does not seed users outside development", async () => {
    const service = new UsersService(createConfigService("test"));

    await service.onModuleInit();

    await expect(service.findAll()).resolves.toEqual([]);
  });

  it("allows demo users to be disabled explicitly in development", async () => {
    const service = new UsersService(
      createConfigService("development", "false"),
    );

    await service.onModuleInit();

    await expect(service.findAll()).resolves.toEqual([]);
  });
});
