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
  it("seeds six built-in users with stable automation IDs", async () => {
    const service = new UsersService(createConfigService("development"));

    await service.onModuleInit();

    const users = await service.findAll();
    expect(users).toHaveLength(6);
    expect(
      users.map((user) => [user.automationId, user.email, user.role]),
    ).toEqual([
      [1, "emiradmin@ello.com", UserRole.Admin],
      [2, "emiruser@ello.com", UserRole.User],
      [3, "asliadmin@ello.com", UserRole.Admin],
      [4, "asliuser@ello.com", UserRole.User],
      [5, "gulsimaadmin@ello.com", UserRole.Admin],
      [6, "gulsimauser@ello.com", UserRole.User],
    ]);

    const admin = await service.findByEmail("emiradmin@ello.com");
    expect(admin).toBeDefined();
    await expect(
      bcrypt.compare("123456", admin?.passwordHash ?? ""),
    ).resolves.toBe(true);
    await expect(service.resolveUserReference("1")).resolves.toBe(admin?.id);
    await expect(service.resolveUserReference(admin!.id)).resolves.toBe(
      admin?.id,
    );
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

  it("updates a user's public profile", async () => {
    const service = new UsersService(createConfigService("development"));
    await service.onModuleInit();
    const admin = await service.findByEmail("emiradmin@ello.com");

    const updated = await service.updateProfile(admin!.id, {
      username: "admin_updated",
      about: "Coordinates ellO workspaces.",
      location: "Istanbul, TR",
    });

    expect(updated).toMatchObject({
      username: "admin_updated",
      about: "Coordinates ellO workspaces.",
      location: "Istanbul, TR",
    });
    expect(updated).not.toHaveProperty("passwordHash");
  });
});
