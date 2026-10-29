import type { TenantDb } from "@/lib/db/tenant";
import {
  actionConfigSchemas,
  triggerConfigSchemas,
  type ActionType,
  type TriggerConfig,
  type TriggerType,
} from "./types";

export function listWorkflows(db: TenantDb) {
  return db.workflow.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { actions: true, runs: true } } },
  });
}

export function getWorkflow(db: TenantDb, id: string) {
  return db.workflow.findFirst({
    where: { id },
    include: { actions: { orderBy: { position: "asc" } } },
  });
}

export function listRuns(db: TenantDb, workflowId: string, take = 50) {
  return db.workflowRun.findMany({
    where: { workflowId },
    orderBy: { createdAt: "desc" },
    take,
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
}

/** Validates a trigger filter; drops empty values so "any" stays `{}`. */
export function validateTriggerConfig(type: TriggerType, raw: Record<string, unknown>): TriggerConfig {
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== "" && v !== undefined && v !== null));
  return triggerConfigSchemas[type].parse(cleaned) as TriggerConfig;
}

async function assertStageRefs(db: TenantDb, config: { pipelineId?: string; stageId?: string }) {
  if (config.stageId) {
    const stage = await db.stage.findFirst({ where: { id: config.stageId } });
    if (!stage || (config.pipelineId && stage.pipelineId !== config.pipelineId)) throw new Error("Unknown stage");
  } else if (config.pipelineId) {
    const pipeline = await db.pipeline.findFirst({ where: { id: config.pipelineId } });
    if (!pipeline) throw new Error("Unknown pipeline");
  }
}

export async function createWorkflow(db: TenantDb, input: { name: string; triggerType: TriggerType; triggerConfig: Record<string, unknown> }) {
  const config = validateTriggerConfig(input.triggerType, input.triggerConfig);
  await assertStageRefs(db, config);
  return db.workflow.create({
    data: {
      subAccountId: db.$subAccountId,
      name: input.name,
      triggerType: input.triggerType,
      triggerConfig: JSON.stringify(config),
    },
  });
}

export async function updateWorkflowTrigger(
  db: TenantDb,
  id: string,
  input: { name: string; triggerType: TriggerType; triggerConfig: Record<string, unknown> },
) {
  const config = validateTriggerConfig(input.triggerType, input.triggerConfig);
  await assertStageRefs(db, config);
  return db.workflow.update({
    where: { id },
    data: { name: input.name, triggerType: input.triggerType, triggerConfig: JSON.stringify(config) },
  });
}

export function setWorkflowActive(db: TenantDb, id: string, active: boolean) {
  return db.workflow.update({ where: { id }, data: { active } });
}

export function deleteWorkflow(db: TenantDb, id: string) {
  return db.workflow.delete({ where: { id } });
}

export async function addAction(db: TenantDb, workflowId: string, type: ActionType, rawConfig: Record<string, unknown>) {
  const workflow = await db.workflow.findFirst({ where: { id: workflowId } });
  if (!workflow) throw new Error("Workflow not found");
  const config = actionConfigSchemas[type].parse(rawConfig);
  if (type === "move_opportunity") await assertStageRefs(db, config as { pipelineId: string; stageId: string });
  const position = await db.workflowAction.count({ where: { workflowId } });
  return db.workflowAction.create({
    data: { subAccountId: db.$subAccountId, workflowId, position, type, config: JSON.stringify(config) },
  });
}

/** Re-numbers positions 0..n-1 in the given order. */
async function renumber(db: TenantDb, ids: string[]) {
  for (const [position, id] of ids.entries()) {
    await db.workflowAction.update({ where: { id }, data: { position } });
  }
}

export async function deleteAction(db: TenantDb, actionId: string) {
  const action = await db.workflowAction.findFirst({ where: { id: actionId } });
  if (!action) throw new Error("Action not found");
  await db.workflowAction.delete({ where: { id: action.id } });
  const rest = await db.workflowAction.findMany({ where: { workflowId: action.workflowId }, orderBy: { position: "asc" } });
  await renumber(db, rest.map((a) => a.id));
}

export async function moveAction(db: TenantDb, actionId: string, direction: "up" | "down") {
  const action = await db.workflowAction.findFirst({ where: { id: actionId } });
  if (!action) throw new Error("Action not found");
  const all = await db.workflowAction.findMany({ where: { workflowId: action.workflowId }, orderBy: { position: "asc" } });
  const ids = all.map((a) => a.id);
  const index = ids.indexOf(action.id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await renumber(db, ids);
}
