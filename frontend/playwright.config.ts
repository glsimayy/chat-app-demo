import { defineConfig, devices } from "@playwright/test";

const frontendUrl = "http://127.0.0.1:5173";
const backendUrl = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm --prefix ../backend run start:dev",
      url: `${backendUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: "3000",
        API_PREFIX: "api",
        CORS_ORIGIN: `${frontendUrl},http://localhost:5173`,
        SWAGGER_ENABLED: "false",
        JWT_SECRET: "playwright-jwt-secret-with-at-least-32-characters",
        BOT_WEBHOOK_SECRET: "playwright-bot-secret-with-at-least-32-characters",
      },
    },
    {
      command: "npm start",
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        BROWSER: "none",
        REACT_APP_API_URL: `${backendUrl}/api`,
      },
    },
  ],
});
