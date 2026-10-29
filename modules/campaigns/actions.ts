"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction, str } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { processTenant } from "@/modules/automation/runner";
import {
  addCampaignStep,
  createCampaign,
  deleteCampaign,
  deleteCampaignStep,
  enrollByTag,
  enrollContacts,
  moveCampaignStep,
  setCampaignStatus,
  stopEnrollment,
  type CampaignStepInput,
} from "./service";

export async function createCampaignAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const { db } = await requirePermission("campaigns:manage");
    id = (await createCampaign(db, str(formData, "name"))).id;
  });
  if (result?.error) return result;
  redirect(`/campaigns/${id}`);
}

export async function addCampaignStepAction(campaignId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("campaigns:manage");
    const type = str(formData, "type");
    const input = {
      type,
      subject: str(formData, "subject"),
      body: str(formData, "body"),
      waitAmount: str(formData, "waitAmount"),
      waitUnit: str(formData, "waitUnit"),
    } as CampaignStepInput;
    await addCampaignStep(db, campaignId, input);
    revalidatePath(`/campaigns/${campaignId}`);
  });
}

export async function deleteCampaignStepAction(campaignId: string, stepId: string): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("campaigns:manage");
    await deleteCampaignStep(db, stepId);
    revalidatePath(`/campaigns/${campaignId}`);
  });
}

export async function moveCampaignStepAction(campaignId: string, stepId: string, direction: "up" | "down"): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("campaigns:manage");
    await moveCampaignStep(db, stepId, direction);
    revalidatePath(`/campaigns/${campaignId}`);
  });
}

export async function setCampaignStatusAction(campaignId: string, status: string): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("campaigns:manage");
    await setCampaignStatus(db, campaignId, status);
    // Activating sends whatever is due right away instead of waiting for the cron.
    if (status === "active") await processTenant(db);
    revalidatePath("/", "layout");
  });
}

export async function deleteCampaignAction(campaignId: string): Promise<ActionState> {
  const result = await runAction(async () => {
    const { db } = await requirePermission("campaigns:manage");
    await deleteCampaign(db, campaignId);
  });
  if (result?.error) return result;
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

export async function enrollAction(campaignId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("campaigns:enroll");
    const tag = str(formData, "tag");
    const contactIds = formData.getAll("contactIds").filter((v): v is string => typeof v === "string" && v !== "");
    let count = 0;
    if (tag) count += await enrollByTag(db, campaignId, tag);
    if (contactIds.length) count += await enrollContacts(db, campaignId, contactIds);
    if (!tag && !contactIds.length) throw new Error("Pick a tag or at least one contact");
    await processTenant(db);
    revalidatePath("/", "layout");
    return `Enrolled ${count} new contact${count === 1 ? "" : "s"}`;
  });
}

/** Enroll one contact from their contact page. */
export async function enrollContactAction(contactId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("campaigns:enroll");
    const count = await enrollContacts(db, str(formData, "campaignId"), [contactId]);
    await processTenant(db);
    revalidatePath("/", "layout");
    return count ? "Enrolled" : "Already enrolled";
  });
}

export async function stopEnrollmentAction(campaignId: string, enrollmentId: string): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("campaigns:enroll");
    await stopEnrollment(db, enrollmentId);
    revalidatePath(`/campaigns/${campaignId}`);
  });
}
