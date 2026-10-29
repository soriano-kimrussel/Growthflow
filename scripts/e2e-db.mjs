// Recreates the disposable end-to-end database (prisma/e2e.db).
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`prisma/e2e.db${suffix}`, { force: true });
execSync("npx prisma db push", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "file:./prisma/e2e.db" },
});
