export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv = String(config.NODE_ENV ?? "development");
  const port = Number(config.PORT ?? 3000);
  const apiPrefix = String(config.API_PREFIX ?? "api").trim();
  const swaggerEnabled = String(config.SWAGGER_ENABLED ?? "true");
  const jwtSecret = String(config.JWT_SECRET ?? "dev-secret");
  const botWebhookSecret = String(
    config.BOT_WEBHOOK_SECRET ?? "dev-bot-secret",
  );

  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number");
  }

  if (!apiPrefix) {
    throw new Error("API_PREFIX cannot be empty");
  }

  if (!["true", "false"].includes(swaggerEnabled)) {
    throw new Error("SWAGGER_ENABLED must be true or false");
  }

  if (nodeEnv === "production") {
    if (jwtSecret.length < 32 || jwtSecret === "dev-secret") {
      throw new Error(
        "JWT_SECRET must be at least 32 characters in production",
      );
    }

    if (botWebhookSecret.length < 32 || botWebhookSecret === "dev-bot-secret") {
      throw new Error(
        "BOT_WEBHOOK_SECRET must be at least 32 characters in production",
      );
    }
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: String(port),
    API_PREFIX: apiPrefix,
    CORS_ORIGIN: String(config.CORS_ORIGIN ?? "*"),
    SWAGGER_ENABLED: swaggerEnabled,
    DATABASE_URL: config.DATABASE_URL ? String(config.DATABASE_URL) : undefined,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? "1d"),
    BOT_WEBHOOK_SECRET: botWebhookSecret,
    DEV_RESET_SECRET: config.DEV_RESET_SECRET
      ? String(config.DEV_RESET_SECRET)
      : undefined,
  };
}
