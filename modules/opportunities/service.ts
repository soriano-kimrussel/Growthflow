import type { TenantDb } from "@/lib/db/tenant";
import { assertOwned } from "@/lib/db/tenant";
import { isOneOf, OPPORTUNITY_STATUSES, type OpportunityStatus } from "@/lib/domain";
import { logActivity } from "@/modules/timeline/service";
import { emitTrigger } from "@/modules/workflows/engine";
import { applyStageChange } from "./stage";

export const DEFAULT_STAGES = ["New Lead", "Contacted", "Proposal Sent", "Closed Won"];

export function listPipelines(db: TenantDb) {
  return db.pipeline.findMany({
    orderBy: { createdAt: "asc" },
    include: { stages: { orderBy: { position: "asc" } } },
  });
}

export function getBoard(db: TenantDb, pipelineId: string) {
  return db.pipeline.findFirst({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: {
          opportunities: {
            orderBy: { updatedAt: "desc" },
            include: { contact: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
}

export async function createPipeline(db: TenantDb, name: string, stageNames: string[]) {
  const stages = stageNames.map((s) => s.trim()).filter(Boolean);
  if (!name.trim()) throw new Error("Pipeline name is required");
  if (stages.length === 0) throw new Error("A pipeline needs at least one stage");
  const pipeline = await db.pipeline.create({ data: { subAccountId: db.$subAccountId, name: name.trim() } });
  await db.stage.createMany({
    data: stages.map((stageName, position) => ({
      subAccountId: db.$subAccountId,
      pipelineId: pipeline.id,
      name: stageName,
      position,
    })),
  });
  return pipeline;
}

export async function addStage(db: TenantDb, pipelineId: string, name: string) {
  await assertOwned(db.pipeline, pipelineId, "Pipeline");
  if (!name.trim()) throw new Error("Stage name is required");
  const position = await db.stage.count({ where: { pipelineId } });
  return db.stage.create({ data: { subAccountId: db.$subAccountId, pipelineId, name: name.trim(), position } });
}

export async function deleteStage(db: TenantDb, stageId: string) {
  const stage = await db.stage.findFirst({ where: { id: stageId }, include: { _count: { select: { opportunities: true } } } });
  if (!stage) throw new Error("Stage not found");
  if (stage._count.opportunities > 0) throw new Error("Move or delete this stage's opportunities first");
  await db.stage.delete({ where: { id: stage.id } });
  const rest = await db.stage.findMany({ where: { pipelineId: stage.pipelineId }, orderBy: { position: "asc" } });
  for (const [position, s] of rest.entries()) await db.stage.update({ where: { id: s.id }, data: { position } });
}

export async function deletePipeline(db: TenantDb, pipelineId: string) {
  return db.pipeline.delete({ where: { id: pipelineId } });
}

export interface OpportunityInput {
  pipelineId: string;
  stageId: string;
  contactId: string;
  title: string;
  value: number;
}

export async function createOpportunity(db: TenantDb, input: OpportunityInput) {
  if (!input.title.trim()) throw new Error("Title is required");
  if (!Number.isInteger(input.value) || input.value < 0) throw new Error("Value must be a positive amount");
  await assertOwned(db.contact, input.contactId, "Contact");
  const stage = await db.stage.findFirst({ where: { id: input.stageId, pipelineId: input.pipelineId } });
  if (!stage) throw new Error("Stage not found in this pipeline");
  const opportunity = await db.opportunity.create({
    data: {
      subAccountId: db.$subAccountId,
      pipelineId: input.pipelineId,
      stageId: stage.id,
      contactId: input.contactId,
      title: input.title.trim(),
      value: input.value,
    },
  });
  await logActivity(db, input.contactId, "opportunity_created", `Opportunity "${opportunity.title}" created in ${stage.name}`);
  return opportunity;
}

/** Moves an opportunity (Kanban drop), logs it, and fires the stage trigger. */
export async function moveOpportunity(db: TenantDb, opportunityId: string, toStageId: string, opts: { actor?: string; now?: Date } = {}) {
  const change = await applyStageChange(db, opportunityId, toStageId, opts.actor);
  if (change) await emitTrigger(db, { type: "opportunity_stage_changed", ...change }, { now: opts.now });
  return change;
}

export async function setOpportunityStatus(db: TenantDb, opportunityId: string, status: string) {
  if (!isOneOf(OPPORTUNITY_STATUSES, status)) throw new Error("Invalid status");
  const opportunity = await db.opportunity.findFirst({ where: { id: opportunityId } });
  if (!opportunity) throw new Error("Opportunity not found");
  await db.opportunity.update({ where: { id: opportunity.id }, data: { status: status as OpportunityStatus } });
  await logActivity(db, opportunity.contactId, "stage_changed", `"${opportunity.title}" marked ${status}`);
}

export function deleteOpportunity(db: TenantDb, opportunityId: string) {
  return db.opportunity.delete({ where: { id: opportunityId } });
}
