import type { TenantDb } from "@/lib/db/tenant";

/** Tags are case-insensitive: stored trimmed and lower-cased. */
export function normalizeTag(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
}

export function parseTagList(input: string): string[] {
  return [...new Set(input.split(",").map(normalizeTag).filter(Boolean))];
}

export async function ensureTag(db: TenantDb, name: string) {
  const normalized = normalizeTag(name);
  if (!normalized) throw new Error("Tag name is required");
  const existing = await db.tag.findFirst({ where: { name: normalized } });
  if (existing) return existing;
  return db.tag.create({ data: { subAccountId: db.$subAccountId, name: normalized } });
}

/**
 * Attaches a tag. Returns the normalized name when the tag was newly added,
 * or null when the contact already had it. Does not log or emit triggers;
 * callers (contacts service, workflow engine) do that.
 */
export async function attachTag(db: TenantDb, contactId: string, name: string): Promise<string | null> {
  const tag = await ensureTag(db, name);
  const existing = await db.contactTag.findFirst({ where: { contactId, tagId: tag.id } });
  if (existing) return null;
  await db.contactTag.create({ data: { subAccountId: db.$subAccountId, contactId, tagId: tag.id } });
  return tag.name;
}

/** Detaches a tag. Returns the normalized name when it was removed. */
export async function detachTag(db: TenantDb, contactId: string, name: string): Promise<string | null> {
  const normalized = normalizeTag(name);
  const tag = await db.tag.findFirst({ where: { name: normalized } });
  if (!tag) return null;
  const { count } = await db.contactTag.deleteMany({ where: { contactId, tagId: tag.id } });
  return count > 0 ? normalized : null;
}

export function listTags(db: TenantDb) {
  return db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
}
