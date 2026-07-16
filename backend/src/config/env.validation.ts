import { parseCorsOrigin } from "./cors-origin";

export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv = String(config.NODE_ENV ?? "development");
  const port = Number(config.PORT ?? 3000);
  const apiPrefix = String(config.API_PREFIX ?? "api").trim();
  const corsOrigin = String(config.CORS_ORIGIN ?? "*").trim();
  const swaggerEnabled = String(
    config.SWAGGER_ENABLED ?? (nodeEnv === "production" ? "false" : "true"),
  );
  const bodyLimit = String(config.BODY_LIMIT ?? "1mb")
    .trim()
    .toLowerCase();
  const rateLimitTtlMs = parsePositiveInteger(
    config.RATE_LIMIT_TTL_MS,
    60_000,
    "RATE_LIMIT_TTL_MS",
  );
  const rateLimitMax = parsePositiveInteger(
    config.RATE_LIMIT_MAX,
    120,
    "RATE_LIMIT_MAX",
  );
  const socketRateLimitTtlMs = parsePositiveInteger(
    config.SOCKET_RATE_LIMIT_TTL_MS,
    10_000,
    "SOCKET_RATE_LIMIT_TTL_MS",
  );
  const socketRateLimitMax = parsePositiveInteger(
    config.SOCKET_RATE_LIMIT_MAX,
    60,
    "SOCKET_RATE_LIMIT_MAX",
  );
  const jwtSecret = String(config.JWT_SECRET ?? "dev-secret").trim();
  const botWebhookSecret = String(
    config.BOT_WEBHOOK_SECRET ?? "dev-bot-secret",
  ).trim();
  const databaseUrl = config.DATABASE_URL
    ? String(config.DATABASE_URL).trim()
    : undefined;
  const demoUsersEnabled = parseBoolean(
    config.DEMO_USERS_ENABLED,
    nodeEnv === "development",
    "DEMO_USERS_ENABLED",
  );
  const devRoutesEnabled = parseBoolean(
    config.DEV_ROUTES_ENABLED,
    nodeEnv === "development",
    "DEV_ROUTES_ENABLED",
  );
  const serveDemoUi = parseBoolean(
    config.SERVE_DEMO_UI,
    nodeEnv === "development",
    "SERVE_DEMO_UI",
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

  if (!corsOrigin) {
    throw new Error("CORS_ORIGIN cannot be empty");
  }

  parseCorsOrigin(corsOrigin);

  if (!/^\d+(b|kb|mb)$/.test(bodyLimit)) {
    throw new Error("BODY_LIMIT must use b, kb, or mb units");
  }

  if (databaseUrl) {
    validateDatabaseUrl(databaseUrl);
  }

  if (nodeEnv === "production") {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required in production");
    }

    if (corsOrigin === "*") {
      throw new Error("CORS_ORIGIN cannot be wildcard in production");
    }

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

    if (demoUsersEnabled || devRoutesEnabled || serveDemoUi) {
      throw new Error(
        "DEMO_USERS_ENABLED, DEV_ROUTES_ENABLED, and SERVE_DEMO_UI must be false in production",
      );
    }
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: String(port),
    API_PREFIX: apiPrefix,
    CORS_ORIGIN: corsOrigin,
    SWAGGER_ENABLED: swaggerEnabled,
    BODY_LIMIT: bodyLimit,
    RATE_LIMIT_TTL_MS: String(rateLimitTtlMs),
    RATE_LIMIT_MAX: String(rateLimitMax),
    SOCKET_RATE_LIMIT_TTL_MS: String(socketRateLimitTtlMs),
    SOCKET_RATE_LIMIT_MAX: String(socketRateLimitMax),
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? "1d"),
    BOT_WEBHOOK_SECRET: botWebhookSecret,
    DEMO_USERS_ENABLED: String(demoUsersEnabled),
    DEV_ROUTES_ENABLED: String(devRoutesEnabled),
    SERVE_DEMO_UI: String(serveDemoUi),
    DEV_RESET_SECRET: config.DEV_RESET_SECRET
      ? String(config.DEV_RESET_SECRET)
      : undefined,
  };
}

function validateDatabaseUrl(value: string) {
  try {
    const url = new URL(value);

    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL");
  }
}

function parseBoolean(value: unknown, fallback: boolean, variableName: string) {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase();

  if (!["true", "false"].includes(normalized)) {
    throw new Error(`${variableName} must be true or false`);
  }

  return normalized === "true";
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  variableName: string,
) {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} must be a positive integer`);
  }

  return parsed;
}
