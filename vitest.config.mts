import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside a React Server Components build.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/support/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      MESSAGING_PROVIDER: "simulated",
      PAYMENTS_PROVIDER: "simulated",
    },
    // Tests share one SQLite file, so run files one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
