import { defineConfig, devices } from "@playwright/test";

const frontendUrl =
  process.env.E2E_FRONTEND_URL || "http://127.0.0.1:5273";
const backendUrl = process.env.E2E_BACKEND_URL || "http://127.0.0.1:3100";
const frontendPort = new URL(frontendUrl).port || "5273";
const backendPort = new URL(backendUrl).port || "3100";
const reuseExistingServer =
  process.env.E2E_REUSE_EXISTING_SERVER === "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: "npm --prefix ../backend run start:dev",
      url: `${backendUrl}/api/health`,
      reuseExistingServer,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: backendPort,
        API_PREFIX: "api",
        CORS_ORIGIN: `${frontendUrl},http://localhost:5173`,
        SWAGGER_ENABLED: "false",
        DATABASE_URL: "",
        JWT_SECRET: "playwright-jwt-secret-with-at-least-32-characters",
        BOT_WEBHOOK_SECRET: "playwright-bot-secret-with-at-least-32-characters",
        RATE_LIMIT_MAX: "10000",
        SOCKET_RATE_LIMIT_MAX: "10000",
      },
    },
    {
      command: `npx cross-env PORT=${frontendPort} react-scripts start`,
      url: frontendUrl,
      reuseExistingServer,
      timeout: 180_000,
      env: {
        ...process.env,
        BROWSER: "none",
        REACT_APP_API_URL: `${backendUrl}/api`,
      },
    },
  ],
});
