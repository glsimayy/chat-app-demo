import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("uses secure production defaults", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      CORS_ORIGIN: "https://chat.example.com",
      DATABASE_URL: "postgresql://postgres:postgres@db:5432/chat",
      JWT_SECRET: "j".repeat(32),
      BOT_WEBHOOK_SECRET: "b".repeat(32),
    });

    expect(result.SWAGGER_ENABLED).toBe("false");
    expect(result.BODY_LIMIT).toBe("1mb");
    expect(result.RATE_LIMIT_MAX).toBe("120");
    expect(result.SOCKET_RATE_LIMIT_MAX).toBe("60");
    expect(result.DEMO_USERS_ENABLED).toBe("false");
    expect(result.DEV_ROUTES_ENABLED).toBe("false");
    expect(result.SERVE_DEMO_UI).toBe("false");
  });

  it("rejects wildcard CORS in production", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        CORS_ORIGIN: "*",
        DATABASE_URL: "postgresql://postgres:postgres@db:5432/chat",
        JWT_SECRET: "j".repeat(32),
        BOT_WEBHOOK_SECRET: "b".repeat(32),
      }),
    ).toThrow("CORS_ORIGIN cannot be wildcard in production");
  });

  it("rejects invalid rate limit values", () => {
    expect(() => validateEnv({ RATE_LIMIT_MAX: 0 })).toThrow(
      "RATE_LIMIT_MAX must be a positive integer",
    );
  });

  it("requires PostgreSQL persistence in production", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        CORS_ORIGIN: "https://chat.example.com",
        JWT_SECRET: "j".repeat(32),
        BOT_WEBHOOK_SECRET: "b".repeat(32),
      }),
    ).toThrow("DATABASE_URL is required in production");
  });

  it.each([
    ["JWT_SECRET", "local-compose-jwt-secret-change-before-production"],
    ["JWT_SECRET", "replace-with-a-random-secret-of-at-least-32-characters"],
    ["BOT_WEBHOOK_SECRET", "local-compose-bot-secret-change-before-production"],
  ])("rejects documented %s placeholders in production", (key, value) => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        CORS_ORIGIN: "https://chat.example.com",
        DATABASE_URL: "postgresql://postgres:postgres@db:5432/chat",
        JWT_SECRET: key === "JWT_SECRET" ? value : "j".repeat(32),
        BOT_WEBHOOK_SECRET:
          key === "BOT_WEBHOOK_SECRET" ? value : "b".repeat(32),
      }),
    ).toThrow(`${key} must be at least 32 random characters in production`);
  });

  it("rejects development-only features in production", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        CORS_ORIGIN: "https://chat.example.com",
        DATABASE_URL: "postgresql://postgres:postgres@db:5432/chat",
        JWT_SECRET: "j".repeat(32),
        BOT_WEBHOOK_SECRET: "b".repeat(32),
        DEMO_USERS_ENABLED: "true",
      }),
    ).toThrow("must be false in production");
  });

  it("enables local-only features by default in development", () => {
    const result = validateEnv({ NODE_ENV: "development" });

    expect(result.DEMO_USERS_ENABLED).toBe("true");
    expect(result.DEV_ROUTES_ENABLED).toBe("true");
    expect(result.SERVE_DEMO_UI).toBe("true");
  });

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() =>
      validateEnv({ DATABASE_URL: "mysql://localhost/chat" }),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL connection URL");
  });

  it("rejects invalid boolean feature flags", () => {
    expect(() => validateEnv({ SERVE_DEMO_UI: "yes" })).toThrow(
      "SERVE_DEMO_UI must be true or false",
    );
  });
});
