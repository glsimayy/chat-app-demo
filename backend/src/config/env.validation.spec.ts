import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("uses secure production defaults", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      CORS_ORIGIN: "https://chat.example.com",
      JWT_SECRET: "j".repeat(32),
      BOT_WEBHOOK_SECRET: "b".repeat(32),
    });

    expect(result.SWAGGER_ENABLED).toBe("false");
    expect(result.BODY_LIMIT).toBe("1mb");
    expect(result.RATE_LIMIT_MAX).toBe("120");
    expect(result.SOCKET_RATE_LIMIT_MAX).toBe("60");
  });

  it("rejects wildcard CORS in production", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        CORS_ORIGIN: "*",
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
});
