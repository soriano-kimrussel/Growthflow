import { beforeEach, describe, expect, it } from "vitest";
import type { TenantDb } from "@/lib/db/tenant";
import { createContact } from "@/modules/contacts/service";
import {
  addCampaignStep,
  createCampaign,
  enrollByTag,
  enrollContacts,
  moveCampaignStep,
  processDueEnrollments,
  setCampaignStatus,
} from "@/modules/campaigns/service";
import { at, makeTenants } from "../support/factory";

const T0 = at("2026-02-01T12:00:00Z");
const plus = (ms: number) => new Date(T0.getTime() + ms);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("campaign step progression", () => {
  let db: TenantDb;
  let other: TenantDb;

  beforeEach(async () => {
    ({ dbA: db, dbB: other } = await makeTenants());
  });

  async function welcomeCampaign() {
    const campaign = await createCampaign(db, "Welcome");
    await addCampaignStep(db, campaign.id, { type: "email", subject: "Hi {{first_name}}", body: "Welcome, {{full_name}}!" });
    await addCampaignStep(db, campaign.id, { type: "wait", waitAmount: 1, waitUnit: "days" });
    await addCampaignStep(db, campaign.id, { type: "sms", body: "Day 2 check-in for {{first_name}}" });
    await addCampaignStep(db, campaign.id, { type: "wait", waitAmount: 3, waitUnit: "hours" });
    await addCampaignStep(db, campaign.id, { type: "email", subject: "Last one", body: "Bye {{first_name}}" });
    return campaign;
  }

  it("advances enrolled contacts through email, wait and SMS steps over time", async () => {
    const campaign = await welcomeCampaign();
    const lead = await createContact(db, { firstName: "Lena", lastName: "Ray", email: "lena@x.test", phone: "+1777", tags: "lead" }, { now: T0 });
    await createContact(db, { firstName: "Nolan", email: "n@x.test", tags: "customer" }, { now: T0 });

    expect(await enrollByTag(db, campaign.id, "lead", { now: T0 })).toBe(1);
    expect(await enrollByTag(db, campaign.id, "lead", { now: T0 })).toBe(0); // no double enrollment

    // Draft campaigns do not send.
    expect((await processDueEnrollments(db, { now: T0 })).processed).toBe(0);
    expect(await db.message.count()).toBe(0);

    await setCampaignStatus(db, campaign.id, "active");
    await processDueEnrollments(db, { now: T0 });
    let enrollment = await db.campaignEnrollment.findFirstOrThrow({ where: { campaignId: campaign.id } });
    expect(enrollment).toMatchObject({ contactId: lead.id, currentStep: 2, status: "active" });
    expect(enrollment.nextRunAt?.toISOString()).toBe(plus(DAY).toISOString());
    const first = await db.message.findFirstOrThrow();
    expect(first).toMatchObject({ channel: "email", to: "lena@x.test", subject: "Hi Lena", body: "Welcome, Lena Ray!", source: "campaign" });

    // Before the wait elapses nothing moves.
    expect((await processDueEnrollments(db, { now: plus(DAY - 1) })).processed).toBe(0);

    // After the day: SMS, then the next wait.
    await processDueEnrollments(db, { now: plus(DAY) });
    enrollment = await db.campaignEnrollment.findFirstOrThrow({ where: { id: enrollment.id } });
    expect(enrollment.currentStep).toBe(4);
    expect(enrollment.nextRunAt?.toISOString()).toBe(plus(DAY + 3 * HOUR).toISOString());
    expect(await db.message.findFirst({ where: { channel: "sms" } })).toMatchObject({ body: "Day 2 check-in for Lena", to: "+1777" });

    // Final email, then completed.
    await processDueEnrollments(db, { now: plus(DAY + 3 * HOUR) });
    enrollment = await db.campaignEnrollment.findFirstOrThrow({ where: { id: enrollment.id } });
    expect(enrollment).toMatchObject({ status: "completed", currentStep: 5, nextRunAt: null });
    expect(await db.message.count()).toBe(3);

    const titles = (await db.activity.findMany({ where: { contactId: lead.id } })).map((a) => a.title);
    expect(titles).toEqual(
      expect.arrayContaining(['Enrolled in campaign "Welcome"', 'Completed campaign "Welcome"', expect.stringMatching(/^Email sent: Hi Lena/)]),
    );
    expect(await other.message.count()).toBe(0);
  });

  it("pausing holds enrollments in place and resuming continues", async () => {
    const campaign = await welcomeCampaign();
    await setCampaignStatus(db, campaign.id, "active");
    const c = await createContact(db, { firstName: "Pat", email: "p@x.test", phone: "+1" }, { now: T0 });
    await enrollContacts(db, campaign.id, [c.id], { now: T0 });
    await processDueEnrollments(db, { now: T0 });

    await setCampaignStatus(db, campaign.id, "paused");
    expect((await processDueEnrollments(db, { now: plus(2 * DAY) })).processed).toBe(0);
    await setCampaignStatus(db, campaign.id, "active");
    await processDueEnrollments(db, { now: plus(2 * DAY) });
    expect(await db.message.count({ where: { channel: "sms" } })).toBe(1);
  });

  it("skips (and logs) contacts missing the needed address", async () => {
    const campaign = await createCampaign(db, "SMS only");
    await addCampaignStep(db, campaign.id, { type: "sms", body: "hello" });
    await setCampaignStatus(db, campaign.id, "active");
    const c = await createContact(db, { firstName: "NoPhone" }, { now: T0 });
    await enrollContacts(db, campaign.id, [c.id], { now: T0 });
    await processDueEnrollments(db, { now: T0 });
    expect(await db.message.count()).toBe(0);
    const titles = (await db.activity.findMany({ where: { contactId: c.id } })).map((a) => a.title);
    expect(titles).toContain('SMS skipped (campaign "SMS only")');
  });

  it("ignores contacts from another sub-account when enrolling", async () => {
    const campaign = await createCampaign(db, "Scoped");
    const foreign = await createContact(other, { firstName: "Foreign" }, { now: T0 });
    expect(await enrollContacts(db, campaign.id, [foreign.id], { now: T0 })).toBe(0);
  });

  it("reorders steps", async () => {
    const campaign = await welcomeCampaign();
    const steps = await db.campaignStep.findMany({ where: { campaignId: campaign.id }, orderBy: { position: "asc" } });
    await moveCampaignStep(db, steps[2].id, "up");
    const reordered = await db.campaignStep.findMany({ where: { campaignId: campaign.id }, orderBy: { position: "asc" } });
    expect(reordered.map((s) => s.type)).toEqual(["email", "sms", "wait", "wait", "email"]);
  });
});
