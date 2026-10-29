import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * The unscoped ("system") Prisma client.
 *
 * Application code must NOT query tenant-owned models with this client. Use
 * `tenantDb(subAccountId)` from lib/db/tenant.ts instead. This client is for
 * platform models (agencies, users, sessions, memberships, snapshots) and for
 * the runner, which discovers which sub-accounts have due work and then hands
 * each one a scoped client.
 */
function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = /^postgres(ql)?:\/\//.test(url)
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type SystemDb = typeof prisma;
