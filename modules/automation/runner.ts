import { prisma } from "@/lib/db/prisma";
import { tenantDb, type TenantDb } from "@/lib/db/tenant";
import { processDueEnrollments } from "@/modules/campaigns/service";
import { processDueRuns } from "@/modules/workflows/engine";

/**
 * The automation runner. Advances due workflow runs and campaign enrollments.
 *
 * - `processTenant` works inside one sub-account (the "Process due steps"
 *   button calls it for the current sub-account).
 * - `processAllTenants` is what the scheduled /api/runner endpoint calls. It
 *   uses the system client only to discover WHICH sub-accounts have due work,
 *   then processes each one through its own tenant-scoped client.
 */

export async function processTenant(db: TenantDb, now = new Date()) {
  const workflows = await processDueRuns(db, { now });
  const campaigns = await processDueEnrollments(db, { now });
  return { workflows, campaigns };
}

export async function processAllTenants(now = new Date()) {
  const [runs, enrollments] = await Promise.all([
    prisma.workflowRun.findMany({
      where: { status: "active", nextRunAt: { lte: now } },
      distinct: ["subAccountId"],
      select: { subAccountId: true },
    }),
    prisma.campaignEnrollment.findMany({
      where: { status: "active", nextRunAt: { lte: now }, campaign: { status: "active" } },
      distinct: ["subAccountId"],
      select: { subAccountId: true },
    }),
  ]);
  const ids = [...new Set([...runs, ...enrollments].map((r) => r.subAccountId))];
  const results = [];
  for (const subAccountId of ids) {
    results.push({ subAccountId, ...(await processTenant(tenantDb(subAccountId), now)) });
  }
  return { subAccounts: ids.length, results };
}

/**
 * Demo helper: makes every pending wait in this sub-account due now, then
 * processes. Lets you watch a multi-day sequence play out in one click.
 */
export async function skipWaitsAndProcess(db: TenantDb, now = new Date()) {
  await db.workflowRun.updateMany({ where: { status: "active", nextRunAt: { gt: now } }, data: { nextRunAt: now } });
  await db.campaignEnrollment.updateMany({ where: { status: "active", nextRunAt: { gt: now } }, data: { nextRunAt: now } });
  return processTenant(db, now);
}
