import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // CLI commands (db push) prefer DIRECT_URL: with Supabase, DATABASE_URL is
    // the transaction pooler (for the app) and DIRECT_URL the session pooler.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "file:./prisma/dev.db",
  },
});
