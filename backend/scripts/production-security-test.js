require("dotenv").config({ quiet: true });

const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = Number(process.env.PRODUCTION_TEST_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ALLOWED_ORIGIN = "https://frontend.ello.test";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForHealth(child) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production server exited with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Production server did not become healthy in time");
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required for this test");

  const child = spawn(process.execPath, [path.join("dist", "main.js")], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      API_PREFIX: "api",
      CORS_ORIGIN: ALLOWED_ORIGIN,
      SWAGGER_ENABLED: "false",
      DEMO_USERS_ENABLED: "false",
      DEV_ROUTES_ENABLED: "false",
      SERVE_DEMO_UI: "false",
      JWT_SECRET: "production-test-jwt-secret-with-32-characters",
      BOT_WEBHOOK_SECRET: "production-test-bot-secret-with-32-characters",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForHealth(child);

    const health = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    assert(health.status === 200, "Health endpoint must return 200");
    assert(
      health.headers.get("access-control-allow-origin") === ALLOWED_ORIGIN,
      "Configured production origin must be allowed",
    );
    assert(
      health.headers.get("x-content-type-options") === "nosniff",
      "Helmet security headers must be enabled",
    );

    const deniedOrigin = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: "https://attacker.example" },
    });
    assert(
      deniedOrigin.headers.get("access-control-allow-origin") === null,
      "Unknown production origin must not receive CORS permission",
    );

    for (const check of [
      { route: "/api/docs", method: "GET" },
      { route: "/api/dev/reset", method: "POST" },
      { route: "/demo", method: "GET" },
    ]) {
      const response = await fetch(`${BASE_URL}${check.route}`, {
        method: check.method,
      });
      assert(
        response.status === 404,
        `${check.method} ${check.route} must be disabled in production`,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          checked: [
            "health",
            "allowed and denied CORS origins",
            "Helmet security headers",
            "Swagger disabled",
            "development reset disabled",
            "demo UI disabled",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await stopServer(child);
  }

  if (stderr.trim()) {
    const unexpected = stderr
      .split(/\r?\n/)
      .filter((line) => line && !line.includes("ExperimentalWarning"));
    assert(
      unexpected.length === 0,
      `Production server wrote to stderr:\n${unexpected.join("\n")}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
