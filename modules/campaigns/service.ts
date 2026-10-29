import { z } from "zod";
import type { TenantDb } from "@/lib/db/tenant";
import { CAMPAIGN_STATUSES, isOneOf, WAIT_UNITS, waitToMs, type WaitUnit } from "@/lib/domain";
import { sendToContact } from "@/modules/messaging/service";
import { normalizeTag } from "@/modules/tags/service";
import { logActivity } from "@/modules/timeline/service";

export const campaignStepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("email"), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("sms"), body: z.string().trim().min(1).max(1600) }),
  z.object({ type: z.literal("wait"), waitAmount: z.coerce.number().int().min(1).max(10_000), waitUnit: z.enum(WAIT_UNITS) }),
]);
export type CampaignStepInput = z.input<typeof campaignStepSchema>;

export function listCampaigns(db: TenantDb) {
  return db.campaign.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { steps: true, enrollments: true } } },
  });
}

export function getCampaign(db: TenantDb, id: string) {
  return db.campaign.findFirst({
    where: { id },
    include: {
      steps: { orderBy: { position: "asc" } },
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
}

export function createCampaign(db: TenantDb, name: string) {
  if (!name.trim()) throw new Error("Campaign name is required");
  return db.campaign.create({ data: { subAccountId: db.$subAccountId, name: name.trim() } });
}

export async function setCampaignStatus(db: TenantDb, id: string, status: string) {
  if (!isOneOf(CAMPAIGN_STATUSES, status)) throw new Error("Invalid status");
  return db.campaign.update({ where: { id }, data: { status } });
}

export function deleteCampaign(db: TenantDb, id: string) {
  return db.campaign.delete({ where: { id } });
}

export async function addCampaignStep(db: TenantDb, campaignId: string, raw: CampaignStepInput) {
  const step = campaignStepSchema.parse(raw);
  const campaign = await db.campaign.findFirst({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  const position = await db.campaignStep.count({ where: { campaignId } });
  return db.campaignStep.create({
    data: {
      subAccountId: db.$subAccountId,
      campaignId,
      position,
      type: step.type,
      subject: step.type === "email" ? step.subject : null,
      body: step.type === "wait" ? null : step.body,
      waitAmount: step.type === "wait" ? step.waitAmount : null,
      waitUnit: step.type === "wait" ? step.waitUnit : null,
    },
  });
}

async function renumberSteps(db: TenantDb, ids: string[]) {
  for (const [position, id] of ids.entries()) await db.campaignStep.update({ where: { id }, data: { position } });
}

export async function deleteCampaignStep(db: TenantDb, stepId: string) {
  const step = await db.campaignStep.findFirst({ where: { id: stepId } });
  if (!step) throw new Error("Step not found");
  await db.campaignStep.delete({ where: { id: step.id } });
  const rest = await db.campaignStep.findMany({ where: { campaignId: step.campaignId }, orderBy: { position: "asc" } });
  await renumberSteps(db, rest.map((s) => s.id));
}

export async function moveCampaignStep(db: TenantDb, stepId: string, direction: "up" | "down") {
  const step = await db.campaignStep.findFirst({ where: { id: stepId } });
  if (!step) throw new Error("Step not found");
  const ids = (await db.campaignStep.findMany({ where: { campaignId: step.campaignId }, orderBy: { position: "asc" } })).map((s) => s.id);
  const index = ids.indexOf(step.id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await renumberSteps(db, ids);
}

/**
 * Enrolls contacts (skipping ones already enrolled). Enrollments are due
 * immediately; the runner sends their first steps once the campaign is active.
 */
export async function enrollContacts(db: TenantDb, campaignId: string, contactIds: string[], opts: { now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const campaign = await db.campaign.findFirst({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  const valid = await db.contact.findMany({ where: { id: { in: [...new Set(contactIds)] } }, select: { id: true } });
  const existing = new Set(
    (await db.campaignEnrollment.findMany({ where: { campaignId }, select: { contactId: true } })).map((e) => e.contactId),
  );
  const fresh = valid.map((c) => c.id).filter((id) => !existing.has(id));
  for (const contactId of fresh) {
    await db.campaignEnrollment.create({
      data: { subAccountId: db.$subAccountId, campaignId, contactId, nextRunAt: now },
    });
    await logActivity(db, contactId, "campaign", `Enrolled in campaign "${campaign.name}"`);
  }
  return fresh.length;
}

export async function enrollByTag(db: TenantDb, campaignId: string, tagName: string, opts: { now?: Date } = {}) {
  const tag = normalizeTag(tagName);
  const contacts = await db.contact.findMany({ where: { tags: { some: { tag: { name: tag } } } }, select: { id: true } });
  return enrollContacts(db, campaignId, contacts.map((c) => c.id), opts);
}

export type EnrollmentResult = "waiting" | "completed" | "skipped";

/**
 * Runs an enrollment's steps from `currentStep` until a wait (which schedules
 * `nextRunAt`) or the end of the sequence.
 */
export async function advanceEnrollment(db: TenantDb, enrollmentId: string, opts: { now?: Date } = {}): Promise<EnrollmentResult> {
  const now = opts.now ?? new Date();
  const enrollment = await db.campaignEnrollment.findFirst({
    where: { id: enrollmentId, status: "active" },
    include: { campaign: { include: { steps: { orderBy: { position: "asc" } } } }, contact: true },
  });
  if (!enrollment || !enrollment.nextRunAt || enrollment.nextRunAt > now) return "skipped";
  if (enrollment.campaign.status !== "active") return "skipped";

  const claim = await db.campaignEnrollment.updateMany({
    where: { id: enrollment.id, status: "active", nextRunAt: enrollment.nextRunAt },
    data: { nextRunAt: null },
  });
  if (claim.count !== 1) return "skipped";

  const { campaign, contact } = enrollment;
  const via = `campaign "${campaign.name}"`;
  let step = enrollment.currentStep;
  while (step < campaign.steps.length) {
    const current = campaign.steps[step];
    step += 1;
    if (current.type === "wait") {
      const until = new Date(now.getTime() + waitToMs(current.waitAmount ?? 1, (current.waitUnit ?? "days") as WaitUnit));
      await db.campaignEnrollment.update({ where: { id: enrollment.id }, data: { currentStep: step, nextRunAt: until } });
      return "waiting";
    }
    await sendToContact(db, {
      contact,
      channel: current.type === "sms" ? "sms" : "email",
      subject: current.subject,
      body: current.body ?? "",
      source: "campaign",
      sourceId: campaign.id,
      via,
    });
    await db.campaignEnrollment.update({ where: { id: enrollment.id }, data: { currentStep: step } });
  }
  await db.campaignEnrollment.update({ where: { id: enrollment.id }, data: { status: "completed", currentStep: step } });
  await logActivity(db, contact.id, "campaign", `Completed campaign "${campaign.name}"`);
  return "completed";
}

/** Advances every due enrollment of active campaigns in this sub-account. */
export async function processDueEnrollments(db: TenantDb, opts: { now?: Date; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const due = await db.campaignEnrollment.findMany({
    where: { status: "active", nextRunAt: { lte: now }, campaign: { status: "active" } },
    orderBy: { nextRunAt: "asc" },
    take: opts.limit ?? 200,
    select: { id: true },
  });
  const results: Record<EnrollmentResult, number> = { waiting: 0, completed: 0, skipped: 0 };
  for (const { id } of due) results[await advanceEnrollment(db, id, { now })] += 1;
  return { processed: due.length, ...results };
}

export async function stopEnrollment(db: TenantDb, enrollmentId: string) {
  return db.campaignEnrollment.update({ where: { id: enrollmentId }, data: { status: "stopped", nextRunAt: null } });
}
