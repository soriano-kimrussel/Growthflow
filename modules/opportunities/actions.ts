"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { errorMessage, runAction, str } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { parseMoneyToCents } from "@/lib/money";
import {
  addStage,
  createOpportunity,
  createPipeline,
  deleteOpportunity,
  deletePipeline,
  deleteStage,
  moveOpportunity,
  setOpportunityStatus,
} from "./service";

export async function createPipelineAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const { db } = await requirePermission("pipelines:manage");
    const pipeline = await createPipeline(db, str(formData, "name"), str(formData, "stages").split(","));
    id = pipeline.id;
  });
  if (result?.error) return result;
  revalidatePath("/opportunities");
  redirect(`/opportunities?pipeline=${id}`);
}

export async function addStageAction(pipelineId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("pipelines:manage");
    await addStage(db, pipelineId, str(formData, "name"));
    revalidatePath("/opportunities");
  });
}

export async function deleteStageAction(stageId: string): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("pipelines:manage");
    await deleteStage(db, stageId);
    revalidatePath("/opportunities");
  });
}

export async function deletePipelineAction(pipelineId: string): Promise<ActionState> {
  const result = await runAction(async () => {
    const { db } = await requirePermission("pipelines:manage");
    await deletePipeline(db, pipelineId);
  });
  if (result?.error) return result;
  revalidatePath("/opportunities");
  redirect("/opportunities");
}

export async function createOpportunityAction(pipelineId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("opportunities:write");
    const value = parseMoneyToCents(str(formData, "value") || "0");
    if (value === null) throw new Error("Enter a value like 1500 or 99.50");
    await createOpportunity(db, {
      pipelineId,
      stageId: str(formData, "stageId"),
      contactId: str(formData, "contactId"),
      title: str(formData, "title"),
      value,
    });
    revalidatePath("/opportunities");
  });
}

/** Called by the Kanban board on drop. */
export async function moveOpportunityAction(opportunityId: string, stageId: string): Promise<{ error?: string }> {
  try {
    const { db, user } = await requirePermission("opportunities:write");
    await moveOpportunity(db, opportunityId, stageId, { actor: user.name });
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function setOpportunityStatusAction(opportunityId: string, status: string): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("opportunities:write");
    await setOpportunityStatus(db, opportunityId, status);
    revalidatePath("/", "layout");
  });
}

export async function deleteOpportunityAction(opportunityId: string): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("pipelines:manage");
    await deleteOpportunity(db, opportunityId);
    revalidatePath("/", "layout");
  });
}
