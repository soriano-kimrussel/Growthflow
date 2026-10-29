"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction, str } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { isOneOf } from "@/lib/domain";
import { processTenant, skipWaitsAndProcess } from "@/modules/automation/runner";
import { addAction, createWorkflow, deleteAction, deleteWorkflow, moveAction, setWorkflowActive, updateWorkflowTrigger } from "./service";
import { ACTION_TYPES, TRIGGER_TYPES } from "./types";

function triggerInput(formData: FormData) {
  const triggerType = str(formData, "triggerType");
  if (!isOneOf(TRIGGER_TYPES, triggerType)) throw new Error("Pick a trigger");
  const name = str(formData, "name").trim();
  if (!name) throw new Error("Workflow name is required");
  const [pipelineId, stageId] = str(formData, "stage").split(":");
  return {
    name,
    triggerType,
    triggerConfig: { tag: str(formData, "tag"), status: str(formData, "status"), pipelineId, stageId },
  };
}

export async function createWorkflowAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const { db } = await requirePermission("workflows:manage");
    id = (await createWorkflow(db, triggerInput(formData))).id;
  });
  if (result?.error) return result;
  redirect(`/workflows/${id}`);
}

export async function updateWorkflowAction(workflowId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("workflows:manage");
    await updateWorkflowTrigger(db, workflowId, triggerInput(formData));
    revalidatePath(`/workflows/${workflowId}`);
    return "Saved";
  });
}

export async function setWorkflowActiveAction(workflowId: string, active: boolean): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("workflows:manage");
    await setWorkflowActive(db, workflowId, active);
    revalidatePath("/workflows", "layout");
  });
}

export async function deleteWorkflowAction(workflowId: string): Promise<ActionState> {
  const result = await runAction(async () => {
    const { db } = await requirePermission("workflows:manage");
    await deleteWorkflow(db, workflowId);
  });
  if (result?.error) return result;
  revalidatePath("/workflows");
  redirect("/workflows");
}

export async function addWorkflowActionAction(workflowId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("workflows:manage");
    const type = str(formData, "type");
    if (!isOneOf(ACTION_TYPES, type)) throw new Error("Pick an action");
    const [pipelineId, stageId] = str(formData, "stage").split(":");
    const dueInDays = str(formData, "dueInDays");
    const config: Record<string, unknown> = {
      send_email: { subject: str(formData, "subject"), body: str(formData, "body") },
      send_sms: { body: str(formData, "body") },
      add_tag: { tag: str(formData, "tag") },
      remove_tag: { tag: str(formData, "tag") },
      create_task: { title: str(formData, "title"), ...(dueInDays ? { dueInDays: Number(dueInDays) } : {}) },
      move_opportunity: { pipelineId, stageId },
      wait: { amount: Number(str(formData, "amount")), unit: str(formData, "unit") },
    }[type] as Record<string, unknown>;
    await addAction(db, workflowId, type, config);
    revalidatePath(`/workflows/${workflowId}`);
  });
}

export async function deleteWorkflowStepAction(workflowId: string, actionId: string): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("workflows:manage");
    await deleteAction(db, actionId);
    revalidatePath(`/workflows/${workflowId}`);
  });
}

export async function moveWorkflowStepAction(workflowId: string, actionId: string, direction: "up" | "down"): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("workflows:manage");
    await moveAction(db, actionId, direction);
    revalidatePath(`/workflows/${workflowId}`);
  });
}

/** "Process due steps": advances due workflow runs and campaign enrollments. */
export async function processDueAction(): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("automation:process");
    const { workflows, campaigns } = await processTenant(db);
    revalidatePath("/", "layout");
    return `Processed ${workflows.processed} workflow run(s) and ${campaigns.processed} campaign enrollment(s)`;
  });
}

/** Demo helper: fast-forwards every pending wait in this sub-account. */
export async function skipWaitsAction(): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("automation:process");
    const { workflows, campaigns } = await skipWaitsAndProcess(db);
    revalidatePath("/", "layout");
    return `Skipped waits: advanced ${workflows.processed} run(s) and ${campaigns.processed} enrollment(s)`;
  });
}
