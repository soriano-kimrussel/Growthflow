import { beforeEach, describe, expect, it } from "vitest";
import type { TenantDb } from "@/lib/db/tenant";
import { addTag, createContact } from "@/modules/contacts/service";
import { bookAppointment, setAppointmentStatus } from "@/modules/appointments/service";
import { createOpportunity, createPipeline, moveOpportunity } from "@/modules/opportunities/service";
import { processDueRuns } from "@/modules/workflows/engine";
import { addAction, createWorkflow, setWorkflowActive } from "@/modules/workflows/service";
import { processAllTenants } from "@/modules/automation/runner";
import { at, makeTenants } from "../support/factory";

const T0 = at("2026-01-05T09:00:00Z");
const plus = (ms: number) => new Date(T0.getTime() + ms);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function makePipeline(db: TenantDb) {
  const pipeline = await createPipeline(db, "Sales", ["New", "Qualified", "Won"]);
  const stages = await db.stage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { position: "asc" } });
  return { pipeline, stages };
}

describe("workflow engine", () => {
  let db: TenantDb;
  let other: TenantDb;

  beforeEach(async () => {
    ({ dbA: db, dbB: other } = await makeTenants());
  });

  it("a trigger enrolls a contact and the runner advances steps and applies actions", async () => {
    const { pipeline, stages } = await makePipeline(db);
    const workflow = await createWorkflow(db, { name: "VIP nurture", triggerType: "contact_tag_added", triggerConfig: { tag: "vip" } });
    await addAction(db, workflow.id, "send_email", { subject: "Welcome {{first_name}}", body: "Hi {{first_name}} from {{company}}" });
    await addAction(db, workflow.id, "add_tag", { tag: "nurtured" });
    await addAction(db, workflow.id, "wait", { amount: 2, unit: "days" });
    await addAction(db, workflow.id, "send_sms", { body: "Still interested, {{first_name}}?" });
    await addAction(db, workflow.id, "create_task", { title: "Call VIP", dueInDays: 1 });
    await addAction(db, workflow.id, "move_opportunity", { pipelineId: pipeline.id, stageId: stages[1].id });
    await addAction(db, workflow.id, "remove_tag", { tag: "vip" });
    await setWorkflowActive(db, workflow.id, true);

    const contact = await createContact(db, { firstName: "Vera", email: "vera@x.test", phone: "+15550001", company: "Acme" }, { now: T0 });
    const opp = await createOpportunity(db, { pipelineId: pipeline.id, stageId: stages[0].id, contactId: contact.id, title: "Deal", value: 500_00 });

    // Trigger: adding the tag enrolls the contact and runs up to the wait.
    await addTag(db, contact.id, "VIP", T0);
    const [run] = await db.workflowRun.findMany({ where: { workflowId: workflow.id } });
    expect(run).toMatchObject({ contactId: contact.id, status: "active", currentStep: 3 });
    expect(run.nextRunAt?.toISOString()).toBe(plus(2 * DAY).toISOString());

    const emails = await db.message.findMany({ where: { channel: "email" } });
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ to: "vera@x.test", subject: "Welcome Vera", body: "Hi Vera from Acme", source: "workflow" });
    const tagsNow = await db.contactTag.findMany({ where: { contactId: contact.id }, include: { tag: true } });
    expect(tagsNow.map((t) => t.tag.name).sort()).toEqual(["nurtured", "vip"]);

    // Not due yet: nothing happens.
    expect((await processDueRuns(db, { now: plus(1 * DAY) })).processed).toBe(0);
    expect(await db.message.count({ where: { channel: "sms" } })).toBe(0);

    // Due: the runner (all tenants) continues after the wait.
    await processAllTenants(plus(2 * DAY + 60_000));
    const done = await db.workflowRun.findFirstOrThrow({ where: { id: run.id } });
    expect(done).toMatchObject({ status: "completed", currentStep: 7, nextRunAt: null });

    const sms = await db.message.findFirstOrThrow({ where: { channel: "sms" } });
    expect(sms).toMatchObject({ to: "+15550001", body: "Still interested, Vera?" });
    const task = await db.task.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(task.title).toBe("Call VIP");
    expect(task.dueAt?.toISOString()).toBe(plus(3 * DAY + 60_000).toISOString());
    expect((await db.opportunity.findFirstOrThrow({ where: { id: opp.id } })).stageId).toBe(stages[1].id);
    const finalTags = await db.contactTag.findMany({ where: { contactId: contact.id }, include: { tag: true } });
    expect(finalTags.map((t) => t.tag.name)).toEqual(["nurtured"]);

    // Every action wrote to the timeline.
    const titles = (await db.activity.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" } })).map((a) => a.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Enrolled in workflow "VIP nurture"',
        expect.stringMatching(/^Email sent: Welcome Vera/),
        'Tag "nurtured" added',
        "Waiting 2 days",
        expect.stringMatching(/^SMS sent to \+15550001/),
        "Task created: Call VIP",
        '"Deal" moved from New to Qualified',
        'Tag "vip" removed',
      ]),
    );

    // Isolation: the other tenant saw none of it.
    expect(await other.message.count()).toBe(0);
  });

  it("filters triggers and ignores inactive workflows", async () => {
    const tagged = await createWorkflow(db, { name: "Only hot", triggerType: "contact_tag_added", triggerConfig: { tag: "hot" } });
    await addAction(db, tagged.id, "add_tag", { tag: "seen-hot" });
    await setWorkflowActive(db, tagged.id, true);
    const inactive = await createWorkflow(db, { name: "Off", triggerType: "contact_created", triggerConfig: {} });
    await addAction(db, inactive.id, "add_tag", { tag: "should-not-exist" });

    const contact = await createContact(db, { firstName: "Cold", tags: "cold" }, { now: T0 });
    expect(await db.workflowRun.count()).toBe(0);
    await addTag(db, contact.id, "hot", T0);
    expect(await db.workflowRun.count({ where: { workflowId: tagged.id, status: "completed" } })).toBe(1);
    expect(await db.tag.findFirst({ where: { name: "should-not-exist" } })).toBeNull();
  });

  it("fires on opportunity stage changes, scoped by stage", async () => {
    const { pipeline, stages } = await makePipeline(db);
    const won = await createWorkflow(db, {
      name: "Won follow-up",
      triggerType: "opportunity_stage_changed",
      triggerConfig: { pipelineId: pipeline.id, stageId: stages[2].id },
    });
    await addAction(db, won.id, "send_email", { subject: "Thanks!", body: "Welcome aboard" });
    await setWorkflowActive(db, won.id, true);

    const contact = await createContact(db, { firstName: "Olly", email: "olly@x.test" }, { now: T0 });
    const opp = await createOpportunity(db, { pipelineId: pipeline.id, stageId: stages[0].id, contactId: contact.id, title: "Deal", value: 0 });
    await moveOpportunity(db, opp.id, stages[1].id, { now: T0 });
    expect(await db.workflowRun.count()).toBe(0);
    await moveOpportunity(db, opp.id, stages[2].id, { now: T0 });
    const run = await db.workflowRun.findFirstOrThrow({ where: { workflowId: won.id } });
    expect(run.status).toBe("completed");
    expect(JSON.parse(run.context)).toMatchObject({ opportunityId: opp.id, toStageId: stages[2].id });
    expect(await db.message.count({ where: { subject: "Thanks!" } })).toBe(1);
  });

  it("fires on appointment booked and status changes", async () => {
    const booked = await createWorkflow(db, { name: "Confirm", triggerType: "appointment_booked", triggerConfig: {} });
    await addAction(db, booked.id, "send_sms", { body: "See you soon" });
    await setWorkflowActive(db, booked.id, true);
    const noShow = await createWorkflow(db, { name: "No-show", triggerType: "appointment_status_changed", triggerConfig: { status: "no_show" } });
    await addAction(db, noShow.id, "add_tag", { tag: "no-show" });
    await setWorkflowActive(db, noShow.id, true);

    const contact = await createContact(db, { firstName: "Ann", phone: "+1555" }, { now: T0 });
    const appt = await bookAppointment(db, { contactId: contact.id, title: "Demo", startAt: plus(DAY), endAt: plus(DAY + HOUR) }, { now: T0 });
    expect(await db.message.count({ where: { channel: "sms" } })).toBe(1);

    await setAppointmentStatus(db, appt.id, "showed", { now: T0 });
    expect(await db.workflowRun.count({ where: { workflowId: noShow.id } })).toBe(0);
    await setAppointmentStatus(db, appt.id, "no_show", { now: T0 });
    expect(await db.contactTag.count({ where: { contactId: contact.id } })).toBe(1);
  });

  it("does not loop forever when workflows feed each other", async () => {
    const ping = await createWorkflow(db, { name: "Ping", triggerType: "contact_tag_added", triggerConfig: { tag: "ping" } });
    await addAction(db, ping.id, "remove_tag", { tag: "pong" });
    await addAction(db, ping.id, "add_tag", { tag: "pong" });
    await setWorkflowActive(db, ping.id, true);
    const pong = await createWorkflow(db, { name: "Pong", triggerType: "contact_tag_added", triggerConfig: { tag: "pong" } });
    await addAction(db, pong.id, "remove_tag", { tag: "ping" });
    await addAction(db, pong.id, "add_tag", { tag: "ping" });
    await setWorkflowActive(db, pong.id, true);

    const contact = await createContact(db, { firstName: "Loop" }, { now: T0 });
    await addTag(db, contact.id, "ping", T0);
    // One active run per workflow+contact plus the depth cap keep this bounded.
    expect(await db.workflowRun.count()).toBeLessThanOrEqual(10);
  });

  it("marks a run failed when an action cannot run, and logs why", async () => {
    const { pipeline, stages } = await makePipeline(db);
    const workflow = await createWorkflow(db, { name: "Mover", triggerType: "contact_created", triggerConfig: {} });
    await addAction(db, workflow.id, "move_opportunity", { pipelineId: pipeline.id, stageId: stages[1].id });
    await setWorkflowActive(db, workflow.id, true);
    // Corrupt the stored config to simulate a stage deleted after the fact.
    await db.workflowAction.updateMany({ where: { workflowId: workflow.id }, data: { config: "{}" } });

    const contact = await createContact(db, { firstName: "Fay" }, { now: T0 });
    const run = await db.workflowRun.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(run.status).toBe("failed");
    expect(run.lastError).toBeTruthy();
    const titles = (await db.activity.findMany({ where: { contactId: contact.id } })).map((a) => a.title);
    expect(titles).toContain('Workflow "Mover" failed');
  });
});
