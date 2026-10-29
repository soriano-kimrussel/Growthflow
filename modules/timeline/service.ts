import type { TenantDb } from "@/lib/db/tenant";
import type { ActivityType } from "@/lib/domain";

/** Appends an entry to a contact's activity timeline. */
export async function logActivity(
  db: TenantDb,
  contactId: string,
  type: ActivityType,
  title: string,
  detail?: string | null,
) {
  return db.activity.create({
    data: { subAccountId: db.$subAccountId, contactId, type, title, detail: detail ?? null },
  });
}

export function listTimeline(db: TenantDb, contactId: string, take = 100) {
  return db.activity.findMany({
    where: { contactId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
}

export function recentActivity(db: TenantDb, take = 10) {
  return db.activity.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
}
