const { spawnSync } = require("node:child_process");

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/chat_app_demo",
};

const result = spawnSync("npx", ["prisma", "validate"], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
