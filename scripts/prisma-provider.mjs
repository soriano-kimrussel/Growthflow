// Points prisma/schema.prisma at the database named by DATABASE_URL.
//
// Prisma requires a literal `provider` in the datasource block, so we rewrite
// it before `prisma generate` / `prisma db push`:
//   file:...                      -> sqlite      (local development, tests)
//   postgres:// or postgresql://  -> postgresql  (Vercel + Neon/Supabase)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ quiet: true });

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const provider = /^postgres(ql)?:\/\//.test(url) ? "postgresql" : url.startsWith("file:") ? "sqlite" : null;
if (!provider) {
  console.error(`prisma-provider: unsupported DATABASE_URL scheme: ${url.split(":")[0]}`);
  process.exit(1);
}

const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
const schema = readFileSync(schemaPath, "utf8");
const next = schema.replace(
  /(datasource db \{\s*provider\s*=\s*)"[^"]+"/,
  `$1"${provider}"`,
);
if (next !== schema) {
  writeFileSync(schemaPath, next);
  console.log(`prisma-provider: datasource set to ${provider}`);
}
