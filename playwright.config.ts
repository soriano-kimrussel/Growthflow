import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Runs against a production build, with a disposable database
    // (prisma/e2e.db) rebuilt before the server starts.
    command: `node scripts/e2e-db.mjs && npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 400_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      DATABASE_URL: "file:./prisma/e2e.db",
      MESSAGING_PROVIDER: "simulated",
      PAYMENTS_PROVIDER: "simulated",
      CRON_SECRET: "e2e-secret",
    },
  },
});
