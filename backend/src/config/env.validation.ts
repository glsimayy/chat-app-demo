export function validateEnv(config: Record<string, unknown>) {
  const port = Number(config.PORT ?? 3000);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number");
  }

  return {
    NODE_ENV: String(config.NODE_ENV ?? "development"),
    PORT: String(port),
    API_PREFIX: String(config.API_PREFIX ?? "api"),
    CORS_ORIGIN: String(config.CORS_ORIGIN ?? "*"),
    SWAGGER_ENABLED: String(config.SWAGGER_ENABLED ?? "true"),
    JWT_SECRET: String(config.JWT_SECRET ?? "dev-secret"),
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? "1d"),
    BOT_WEBHOOK_SECRET: String(config.BOT_WEBHOOK_SECRET ?? "dev-bot-secret"),
  };
}
