import { z } from "zod";
import type { TenantDb } from "@/lib/db/tenant";
import { attachTag, detachTag, normalizeTag, parseTagList } from "@/modules/tags/service";
import { logActivity } from "@/modules/timeline/service";
import { emitTrigger } from "@/modules/workflows/engine";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((v) => (v === "" ? null : v));

export const contactInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).default(""),
  email: z
    .string()
    .trim()
    .default("")
    .pipe(z.union([z.literal(""), z.email("Enter a valid email")]))
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  phone: optionalText(40),
  company: optionalText(120),
  tags: z.string().default(""),
  customFields: z.string().default(""),
});
export type ContactInput = z.input<typeof contactInputSchema>;

/** Parses "key: value" lines into a record. */
export function parseCustomFields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim().toLowerCase().replace(/\s+/g, "_");
    const value = line.slice(index + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

export function formatCustomFields(json: string): string {
  try {
    return Object.entries(JSON.parse(json) as Record<string, string>)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  } catch {
    return "";
  }
}

export function buildSearchText(c: { firstName: string; lastName: string; email: string | null; phone: string | null; company: string | null }) {
  return [c.firstName, c.lastName, c.email, c.phone, c.company].filter(Boolean).join(" ").toLowerCase();
}

/** Adds a tag, logs it, and fires the "contact tag added" trigger. */
export async function addTag(db: TenantDb, contactId: string, name: string, now = new Date()) {
  const added = await attachTag(db, contactId, name);
  if (!added) return false;
  await logActivity(db, contactId, "tag_added", `Tag "${added}" added`);
  await emitTrigger(db, { type: "contact_tag_added", contactId, tag: added }, { now });
  return true;
}

export async function removeTag(db: TenantDb, contactId: string, name: string) {
  const removed = await detachTag(db, contactId, name);
  if (removed) await logActivity(db, contactId, "tag_removed", `Tag "${removed}" removed`);
  return Boolean(removed);
}

export async function createContact(db: TenantDb, raw: ContactInput, opts: { actor?: string; now?: Date } = {}) {
  const input = contactInputSchema.parse(raw);
  const contact = await db.contact.create({
    data: {
      subAccountId: db.$subAccountId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      company: input.company,
      customFields: JSON.stringify(parseCustomFields(input.customFields)),
      searchText: buildSearchText(input),
    },
  });
  await logActivity(db, contact.id, "contact_created", "Contact created", opts.actor ? `by ${opts.actor}` : null);
  await emitTrigger(db, { type: "contact_created", contactId: contact.id }, { now: opts.now });
  for (const tag of parseTagList(input.tags)) await addTag(db, contact.id, tag, opts.now);
  return contact;
}

export async function updateContact(db: TenantDb, id: string, raw: ContactInput, opts: { actor?: string } = {}) {
  const input = contactInputSchema.parse(raw);
  const existing = await db.contact.findFirst({ where: { id }, include: { tags: { include: { tag: true } } } });
  if (!existing) throw new Error("Contact not found");

  await db.contact.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      company: input.company,
      customFields: JSON.stringify(parseCustomFields(input.customFields)),
      searchText: buildSearchText(input),
    },
  });
  await logActivity(db, id, "contact_updated", "Contact details updated", opts.actor ? `by ${opts.actor}` : null);

  const current = new Set(existing.tags.map((t) => t.tag.name));
  const wanted = new Set(parseTagList(input.tags));
  for (const name of current) if (!wanted.has(name)) await removeTag(db, id, name);
  for (const name of wanted) if (!current.has(name)) await addTag(db, id, name);
}

export function deleteContact(db: TenantDb, id: string) {
  return db.contact.delete({ where: { id } });
}

export async function addNote(db: TenantDb, contactId: string, body: string, authorName: string) {
  const text = body.trim();
  if (!text) throw new Error("Note cannot be empty");
  const contact = await db.contact.findFirst({ where: { id: contactId }, select: { id: true } });
  if (!contact) throw new Error("Contact not found");
  const note = await db.note.create({ data: { subAccountId: db.$subAccountId, contactId, body: text, authorName } });
  await logActivity(db, contactId, "note_added", `Note added by ${authorName}`, text.slice(0, 280));
  return note;
}

export const CONTACTS_PAGE_SIZE = 20;

export async function listContacts(db: TenantDb, opts: { q?: string; tag?: string; page?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim().toLowerCase();
  const tag = opts.tag ? normalizeTag(opts.tag) : "";
  const where = {
    ...(q ? { searchText: { contains: q } } : {}),
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * CONTACTS_PAGE_SIZE,
      take: CONTACTS_PAGE_SIZE,
      include: { tags: { include: { tag: true } } },
    }),
    db.contact.count({ where }),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE)) };
}

export function getContact(db: TenantDb, id: string) {
  return db.contact.findFirst({
    where: { id },
    include: {
      tags: { include: { tag: true }, orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      opportunities: { include: { stage: true, pipeline: true }, orderBy: { createdAt: "desc" } },
      appointments: { orderBy: { startAt: "desc" } },
      tasks: { orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }] },
      payments: { orderBy: { createdAt: "desc" } },
      enrollments: { include: { campaign: true } },
      workflowRuns: { include: { workflow: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

/** Lightweight list for pickers (opportunity/appointment forms). */
export function contactOptions(db: TenantDb) {
  return db.contact.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 500,
  });
}
