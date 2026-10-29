// Demo data: one agency, two sub-accounts, users across roles, contacts with
// tags, a pipeline with opportunities, appointments, a campaign and workflows.
// Uses the same services as the app, so timelines and outbox look real.
//
//   npm run db:seed        (run once on an empty database)
import "dotenv/config";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { tenantDb, type TenantDb } from "@/lib/db/tenant";
import { createSubAccount } from "@/modules/agency/service";
import { bookAppointment, setAppointmentStatus } from "@/modules/appointments/service";
import { addCampaignStep, enrollByTag, processDueEnrollments, setCampaignStatus, createCampaign } from "@/modules/campaigns/service";
import { addNote, createContact } from "@/modules/contacts/service";
import { createOpportunity, moveOpportunity, setOpportunityStatus } from "@/modules/opportunities/service";
import { createTask } from "@/modules/tasks/service";
import { addAction, createWorkflow, setWorkflowActive } from "@/modules/workflows/service";

const PASSWORD = "password123";
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Today at `hour`:00 UTC plus `days`, rounded so appointments look tidy. */
function slot(days: number, hourUtc: number) {
  const d = new Date();
  d.setUTCHours(hourUtc, 0, 0, 0);
  return new Date(d.getTime() + days * DAY);
}

async function stagesOf(db: TenantDb) {
  const pipeline = await db.pipeline.findFirstOrThrow({ include: { stages: { orderBy: { position: "asc" } } } });
  return { pipeline, stages: pipeline.stages };
}

async function seedDental(db: TenantDb, author: string) {
  const { pipeline, stages } = await stagesOf(db);

  // Workflows first, so the contacts created below trigger them.
  const welcome = await createWorkflow(db, { name: "New lead welcome", triggerType: "contact_tag_added", triggerConfig: { tag: "new-lead" } });
  await addAction(db, welcome.id, "send_email", {
    subject: "Welcome to Bright Smile, {{first_name}}!",
    body: "Hi {{first_name}},\n\nThanks for your interest in Bright Smile Dental. Reply to this email to book your first visit.\n\n— The Bright Smile team",
  });
  await addAction(db, welcome.id, "add_tag", { tag: "nurturing" });
  await addAction(db, welcome.id, "wait", { amount: 1, unit: "days" });
  await addAction(db, welcome.id, "send_sms", { body: "Hi {{first_name}}, it's Bright Smile. Want us to hold a cleaning slot for you this week?" });
  await addAction(db, welcome.id, "create_task", { title: "Call new lead", dueInDays: 1 });
  await setWorkflowActive(db, welcome.id, true);

  const booked = await createWorkflow(db, {
    name: "Consult booked → move deal",
    triggerType: "appointment_booked",
    triggerConfig: {},
  });
  await addAction(db, booked.id, "send_sms", { body: "You're booked, {{first_name}}! Reply C to confirm." });
  await addAction(db, booked.id, "move_opportunity", { pipelineId: pipeline.id, stageId: stages[2].id });
  await setWorkflowActive(db, booked.id, true);

  const won = await createWorkflow(db, {
    name: "Closed won → patient",
    triggerType: "opportunity_stage_changed",
    triggerConfig: { pipelineId: pipeline.id, stageId: stages[3].id },
  });
  await addAction(db, won.id, "add_tag", { tag: "patient" });
  await addAction(db, won.id, "remove_tag", { tag: "new-lead" });
  await setWorkflowActive(db, won.id, true);

  const people = [
    { firstName: "Olivia", lastName: "Martinez", email: "olivia.martinez@example.com", phone: "+1 555 0101", company: "", tags: "new-lead, invisalign" },
    { firstName: "Liam", lastName: "Johnson", email: "liam.j@example.com", phone: "+1 555 0102", company: "Johnson Plumbing", tags: "patient" },
    { firstName: "Emma", lastName: "Chen", email: "emma.chen@example.com", phone: "+1 555 0103", company: "", tags: "patient, whitening" },
    { firstName: "Noah", lastName: "Williams", email: "noah.w@example.com", phone: "", company: "Williams & Co", tags: "new-lead" },
    { firstName: "Ava", lastName: "Brown", email: "ava.brown@example.com", phone: "+1 555 0105", company: "", tags: "patient" },
    { firstName: "Ethan", lastName: "Davis", email: "", phone: "+1 555 0106", company: "", tags: "new-lead, emergency" },
    { firstName: "Sophia", lastName: "Garcia", email: "sophia.g@example.com", phone: "+1 555 0107", company: "Garcia Bakery", tags: "patient, whitening" },
    { firstName: "Mason", lastName: "Miller", email: "mason.miller@example.com", phone: "+1 555 0108", company: "", tags: "lapsed" },
    { firstName: "Isabella", lastName: "Wilson", email: "bella.wilson@example.com", phone: "+1 555 0109", company: "", tags: "patient, vip" },
    { firstName: "Lucas", lastName: "Moore", email: "lucas.moore@example.com", phone: "+1 555 0110", company: "Moore Fitness", tags: "lapsed" },
    { firstName: "Mia", lastName: "Taylor", email: "mia.t@example.com", phone: "+1 555 0111", company: "", tags: "new-lead, invisalign", customFields: "insurance: Delta Dental\nreferred_by: Emma Chen" },
    { firstName: "James", lastName: "Anderson", email: "j.anderson@example.com", phone: "+1 555 0112", company: "Anderson Law", tags: "patient", customFields: "insurance: Cigna" },
  ];
  const contacts = [];
  for (const p of people) contacts.push(await createContact(db, p, { actor: author }));
  const [olivia, liam, emma, noah, ava, ethan, sophia, , isabella, , mia, james] = contacts;

  await addNote(db, olivia.id, "Interested in Invisalign. Asked about payment plans.", author);
  await addNote(db, isabella.id, "VIP: prefers morning appointments and texts over calls.", author);

  const deals = [
    { contact: olivia, title: "Invisalign treatment", value: 4_800_00, stage: 0 },
    { contact: noah, title: "New patient exam", value: 250_00, stage: 0 },
    { contact: mia, title: "Invisalign consult", value: 5_200_00, stage: 1 },
    { contact: ethan, title: "Emergency crown", value: 1_350_00, stage: 1 },
    { contact: emma, title: "Whitening package", value: 650_00, stage: 2 },
    { contact: sophia, title: "Whitening touch-up", value: 300_00, stage: 2 },
  ];
  for (const d of deals) {
    await createOpportunity(db, { pipelineId: pipeline.id, stageId: stages[d.stage].id, contactId: d.contact.id, title: d.title, value: d.value });
  }
  // A deal that walks through the board (and fires the "Closed won" workflow).
  const implant = await createOpportunity(db, { pipelineId: pipeline.id, stageId: stages[0].id, contactId: james.id, title: "Dental implant", value: 3_900_00 });
  await moveOpportunity(db, implant.id, stages[1].id, { actor: author });
  await moveOpportunity(db, implant.id, stages[3].id, { actor: author });
  await setOpportunityStatus(db, implant.id, "won");

  const appts = [
    { contact: liam, title: "Cleaning", start: slot(1, 14), minutes: 45 },
    { contact: isabella, title: "VIP whitening session", start: slot(2, 13), minutes: 60 },
    { contact: ava, title: "Check-up", start: slot(3, 19), minutes: 30 },
    { contact: emma, title: "Whitening consult", start: slot(6, 15), minutes: 30 },
    { contact: james, title: "Implant follow-up", start: slot(-3, 16), minutes: 30, status: "showed" },
    { contact: sophia, title: "Cleaning", start: slot(-2, 18), minutes: 45, status: "no_show" },
  ];
  for (const a of appts) {
    const appt = await bookAppointment(db, { contactId: a.contact.id, title: a.title, startAt: a.start, endAt: new Date(a.start.getTime() + a.minutes * 60_000) });
    if (a.status) await setAppointmentStatus(db, appt.id, a.status);
  }

  await createTask(db, { title: "Send insurance pre-authorization", contactId: mia.id, dueAt: new Date(Date.now() + 2 * DAY) });
  await createTask(db, { title: "Order whitening trays", contactId: emma.id, dueAt: new Date(Date.now() - DAY) });

  const promo = await createCampaign(db, "Spring whitening promo");
  await addCampaignStep(db, promo.id, {
    type: "email",
    subject: "{{first_name}}, brighten your smile this spring",
    body: "Hi {{first_name}},\n\nExisting patients get 20% off whitening through April. Book online or reply to this email.",
  });
  await addCampaignStep(db, promo.id, { type: "wait", waitAmount: 2, waitUnit: "days" });
  await addCampaignStep(db, promo.id, { type: "sms", body: "Bright Smile: 20% off whitening ends soon, {{first_name}}. Reply YES to book." });
  await addCampaignStep(db, promo.id, { type: "wait", waitAmount: 3, waitUnit: "days" });
  await addCampaignStep(db, promo.id, { type: "email", subject: "Last chance for spring whitening", body: "Hi {{first_name}}, the spring offer ends this week." });
  await setCampaignStatus(db, promo.id, "active");
  await enrollByTag(db, promo.id, "patient");
  await processDueEnrollments(db);

  const winback = await createCampaign(db, "Lapsed patient win-back");
  await addCampaignStep(db, winback.id, { type: "email", subject: "We miss you, {{first_name}}", body: "It's been a while! Your next cleaning is on us if you book this month." });
  await addCampaignStep(db, winback.id, { type: "wait", waitAmount: 7, waitUnit: "days" });
  await addCampaignStep(db, winback.id, { type: "sms", body: "Hi {{first_name}}, still want that free cleaning? Reply BOOK." });
  await enrollByTag(db, winback.id, "lapsed"); // stays draft: enrollments wait until activated
}

async function seedFitness(db: TenantDb, author: string) {
  const { pipeline, stages } = await stagesOf(db);
  const trial = await createWorkflow(db, { name: "Trial sign-up", triggerType: "contact_created", triggerConfig: {} });
  await addAction(db, trial.id, "send_email", { subject: "Your free week at Peak, {{first_name}}", body: "Show this email at the front desk to start your free week." });
  await addAction(db, trial.id, "add_tag", { tag: "trial" });
  await setWorkflowActive(db, trial.id, true);

  const members = [
    { firstName: "Riley", lastName: "Parker", email: "riley.p@example.com", phone: "+1 555 0201", tags: "member" },
    { firstName: "Jordan", lastName: "Lee", email: "jordan.lee@example.com", phone: "+1 555 0202", tags: "prospect" },
    { firstName: "Casey", lastName: "Nguyen", email: "casey.n@example.com", phone: "", tags: "prospect, personal-training" },
    { firstName: "Taylor", lastName: "Kim", email: "taylor.kim@example.com", phone: "+1 555 0204", tags: "member" },
  ];
  const created = [];
  for (const m of members) created.push(await createContact(db, m, { actor: author }));
  await createOpportunity(db, { pipelineId: pipeline.id, stageId: stages[0].id, contactId: created[1].id, title: "Annual membership", value: 1_188_00 });
  await createOpportunity(db, { pipelineId: pipeline.id, stageId: stages[1].id, contactId: created[2].id, title: "PT package (10 sessions)", value: 750_00 });
  const start = slot(1, 17);
  await bookAppointment(db, { contactId: created[2].id, title: "Intro PT session", startAt: start, endAt: new Date(start.getTime() + HOUR) });
}

async function main() {
  if (await prisma.user.findUnique({ where: { email: "admin@growthflow.dev" } })) {
    console.log("Seed data already present. Run `npm run db:reset` for a fresh database.");
    return;
  }
  const passwordHash = await hashPassword(PASSWORD);
  const agency = await prisma.agency.create({ data: { name: "Summit Digital Agency" } });
  const admin = await prisma.user.create({
    data: { agencyId: agency.id, email: "admin@growthflow.dev", name: "Alex Rivera", passwordHash, isAgencyAdmin: true },
  });

  const dental = await createSubAccount(agency.id, "Bright Smile Dental", "America/New_York");
  const fitness = await createSubAccount(agency.id, "Peak Fitness Studio", "America/Los_Angeles");

  const users = [
    { email: "dana@brightsmile.test", name: "Dana Brooks", sub: dental.id, role: "admin" },
    { email: "sam@brightsmile.test", name: "Sam Patel", sub: dental.id, role: "user" },
    { email: "pat@peakfitness.test", name: "Pat Morgan", sub: fitness.id, role: "admin" },
  ];
  for (const u of users) {
    const user = await prisma.user.create({ data: { agencyId: agency.id, email: u.email, name: u.name, passwordHash } });
    await prisma.membership.create({ data: { userId: user.id, subAccountId: u.sub, role: u.role } });
  }

  await seedDental(tenantDb(dental.id), "Dana Brooks");
  await seedFitness(tenantDb(fitness.id), "Pat Morgan");

  console.log(`Seeded "${agency.name}" with 2 sub-accounts.`);
  console.log(`  Agency Admin:       ${admin.email} / ${PASSWORD}`);
  for (const u of users) console.log(`  ${u.role === "admin" ? "Sub-Account Admin" : "Sub-Account User "}:  ${u.email} / ${PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
