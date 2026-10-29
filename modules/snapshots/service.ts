import { z } from "zod";
import type { TenantDb } from "@/lib/db/tenant";
import { parseJsonObject } from "@/modules/workflows/types";

/**
 * Snapshots capture a sub-account's structure (pipelines + stages, campaigns +
 * steps, workflows + actions) and clone it into another sub-account. Contacts,
 * messages, runs and enrollments are never included.
 *
 * Workflow configs reference pipelines and stages by id. Captured ids are kept
 * as opaque `ref`s and remapped to the new ids on apply.
 */

const snapshotDataSchema = z.object({
  version: z.literal(1),
  pipelines: z.array(
    z.object({
      ref: z.string(),
      name: z.string(),
      stages: z.array(z.object({ ref: z.string(), name: z.string(), position: z.number() })),
    }),
  ),
  campaigns: z.array(
    z.object({
      name: z.string(),
      steps: z.array(
        z.object({
          type: z.string(),
          subject: z.string().nullable(),
          body: z.string().nullable(),
          waitAmount: z.number().nullable(),
          waitUnit: z.string().nullable(),
        }),
      ),
    }),
  ),
  workflows: z.array(
    z.object({
      name: z.string(),
      triggerType: z.string(),
      triggerConfig: z.record(z.string(), z.unknown()),
      actions: z.array(z.object({ type: z.string(), config: z.record(z.string(), z.unknown()) })),
    }),
  ),
});
export type SnapshotData = z.infer<typeof snapshotDataSchema>;

export async function captureSnapshot(db: TenantDb): Promise<SnapshotData> {
  const [pipelines, campaigns, workflows] = await Promise.all([
    db.pipeline.findMany({ orderBy: { createdAt: "asc" }, include: { stages: { orderBy: { position: "asc" } } } }),
    db.campaign.findMany({ orderBy: { createdAt: "asc" }, include: { steps: { orderBy: { position: "asc" } } } }),
    db.workflow.findMany({ orderBy: { createdAt: "asc" }, include: { actions: { orderBy: { position: "asc" } } } }),
  ]);
  return {
    version: 1,
    pipelines: pipelines.map((p) => ({
      ref: p.id,
      name: p.name,
      stages: p.stages.map((s) => ({ ref: s.id, name: s.name, position: s.position })),
    })),
    campaigns: campaigns.map((c) => ({
      name: c.name,
      steps: c.steps.map((s) => ({
        type: s.type,
        subject: s.subject,
        body: s.body,
        waitAmount: s.waitAmount,
        waitUnit: s.waitUnit,
      })),
    })),
    workflows: workflows.map((w) => ({
      name: w.name,
      triggerType: w.triggerType,
      triggerConfig: parseJsonObject(w.triggerConfig),
      actions: w.actions.map((a) => ({ type: a.type, config: parseJsonObject(a.config) })),
    })),
  };
}

export function parseSnapshotData(json: string): SnapshotData {
  return snapshotDataSchema.parse(JSON.parse(json));
}

/** Rewrites pipelineId/stageId refs. Unknown refs are dropped, never kept. */
export function remapRefs(config: Record<string, unknown>, idMap: Map<string, string>): Record<string, unknown> {
  const out = { ...config };
  for (const key of ["pipelineId", "stageId"]) {
    if (typeof out[key] !== "string") continue;
    const mapped = idMap.get(out[key] as string);
    if (mapped) out[key] = mapped;
    else delete out[key];
  }
  return out;
}

/**
 * Clones a snapshot into the sub-account behind `db`. Campaigns arrive as
 * drafts and workflows switched off, so nothing fires until someone reviews it.
 */
export async function applySnapshot(db: TenantDb, data: SnapshotData) {
  const idMap = new Map<string, string>();
  const subAccountId = db.$subAccountId;

  for (const p of data.pipelines) {
    const pipeline = await db.pipeline.create({ data: { subAccountId, name: p.name } });
    idMap.set(p.ref, pipeline.id);
    for (const s of p.stages) {
      const stage = await db.stage.create({
        data: { subAccountId, pipelineId: pipeline.id, name: s.name, position: s.position },
      });
      idMap.set(s.ref, stage.id);
    }
  }

  for (const c of data.campaigns) {
    const campaign = await db.campaign.create({ data: { subAccountId, name: c.name, status: "draft" } });
    if (c.steps.length) {
      await db.campaignStep.createMany({
        data: c.steps.map((s, position) => ({ subAccountId, campaignId: campaign.id, position, ...s })),
      });
    }
  }

  let skippedActions = 0;
  for (const w of data.workflows) {
    const workflow = await db.workflow.create({
      data: {
        subAccountId,
        name: w.name,
        triggerType: w.triggerType,
        triggerConfig: JSON.stringify(remapRefs(w.triggerConfig, idMap)),
        active: false,
      },
    });
    let position = 0;
    for (const a of w.actions) {
      const config = remapRefs(a.config, idMap);
      // A move action whose stage did not survive the remap cannot run.
      if (a.type === "move_opportunity" && (!config.pipelineId || !config.stageId)) {
        skippedActions += 1;
        continue;
      }
      await db.workflowAction.create({
        data: { subAccountId, workflowId: workflow.id, position: position++, type: a.type, config: JSON.stringify(config) },
      });
    }
  }

  return {
    pipelines: data.pipelines.length,
    campaigns: data.campaigns.length,
    workflows: data.workflows.length,
    skippedActions,
  };
}
