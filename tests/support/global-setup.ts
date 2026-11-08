import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Builds a fresh unit-test SQLite database (prisma/test.db) from the schema.
 * The file is disposable: it is deleted and re-pushed on every run. The env
 * below overrides .env, so tests never touch a hosted database configured there.
 */
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`prisma/test.db${suffix}`, { force: true });
  try {
    execSync("node scripts/prisma-provider.mjs && npx prisma generate && npx prisma db push", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./prisma/test.db", DIRECT_URL: "" },
    });
  } catch (error) {
    const output = (error as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? "";
    throw new Error(`prisma db push failed for the test database:\n${output}`);
  }
}
