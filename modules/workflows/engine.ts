import type { TenantDb } from "@/lib/db/tenant";
import { formatWait, waitToMs } from "@/lib/domain";
import { sendToContact } from "@/modules/messaging/service";
import { applyStageChange } from "@/modules/opportunities/stage";
import { attachTag, detachTag } from "@/modules/tags/service";
import { logActivity } from "@/modules/timeline/service";
import {
  actionConfigSchemas,
  matchesTrigger,
  parseJsonObject,
  TRIGGER_LABELS,
  type ActionType,
  type TriggerConfig,
  type TriggerEvent,
} from "./types";

/**
 * Database-backed workflow engine.
 *
 * - `emitTrigger` finds active workflows whose trigger matches an event,
 *   persists a WorkflowRun per match, and advances each run right away.
 * - `advanceRun` executes actions from the run's `currentStep` until it hits a
 *   wait (persisting `nextRunAt`) or runs out of actions.
 * - `processDueRuns` picks up runs whose wait has elapsed. It is driven by the
 *   runner (API route + "Process due steps" button), never by in-memory timers.
 *
 * Actions can emit triggers themselves (adding a tag fires "tag added"), so
 * nesting is capped by MAX_DEPTH and a contact is never enrolled twice in the
 * same workflow while a run is still active.
 */

const MAX_DEPTH = 4;

export interface EngineOptions {
  now?: Date;
  depth?: number;
}

function eventContext(event: TriggerEvent): Record<string, string> {
  const { type, ...rest } = event;
  return { trigger: type, ...rest };
}

export async function emitTrigger(db: TenantDb, event: TriggerEvent, opts: EngineOptions = {}): Promise<string[]> {
  const now = opts.now ?? new Date();
  const depth = opts.depth ?? 0;
  if (depth > MAX_DEPTH) return [];

  const workflows = await db.workflow.findMany({
    where: { triggerType: event.type, active: true },
    orderBy: { createdAt: "asc" },
  });

  const runIds: string[] = [];
  for (const workflow of workflows) {
    const config = parseJsonObject(workflow.triggerConfig) as TriggerConfig;
    if (!matchesTrigger(workflow.triggerType, config, event)) continue;

    const alreadyRunning = await db.workflowRun.findFirst({
      where: { workflowId: workflow.id, contactId: event.contactId, status: "active" },
      select: { id: true },
    });
    if (alreadyRunning) continue;

    const run = await db.workflowRun.create({
      data: {
        subAccountId: db.$subAccountId,
        workflowId: workflow.id,
        contactId: event.contactId,
        context: JSON.stringify(eventContext(event)),
        nextRunAt: now,
      },
    });
    await logActivity(
      db,
      event.contactId,
      "workflow_action",
      `Enrolled in workflow "${workflow.name}"`,
      `Trigger: ${TRIGGER_LABELS[event.type]}`,
    );
    runIds.push(run.id);
  }

  for (const id of runIds) await advanceRun(db, id, { now, depth });
  return runIds;
}

export type AdvanceResult = "waiting" | "completed" | "failed" | "stopped" | "skipped";

export async function advanceRun(db: TenantDb, runId: string, opts: EngineOptions = {}): Promise<AdvanceResult> {
  const now = opts.now ?? new Date();
  const depth = opts.depth ?? 0;

  const run = await db.workflowRun.findFirst({
    where: { id: runId, status: "active" },
    include: { workflow: { include: { actions: { orderBy: { position: "asc" } } } } },
  });
  if (!run || !run.nextRunAt || run.nextRunAt > now) return "skipped";

  // Claim the run: only one runner may move it forward from this nextRunAt.
  const claim = await db.workflowRun.updateMany({
    where: { id: run.id, status: "active", nextRunAt: run.nextRunAt },
    data: { nextRunAt: null },
  });
  if (claim.count !== 1) return "skipped";

  if (!run.workflow.active) {
    await db.workflowRun.update({ where: { id: run.id }, data: { status: "stopped" } });
    await logActivity(db, run.contactId, "workflow_action", `Workflow "${run.workflow.name}" stopped`, "Workflow was turned off");
    return "stopped";
  }

  const context = parseJsonObject(run.context);
  const actions = run.workflow.actions;
  let step = run.currentStep;
  try {
    while (step < actions.length) {
      const action = actions[step];
      const waitUntil = await executeAction(db, {
        type: action.type as ActionType,
        config: parseJsonObject(action.config),
        contactId: run.contactId,
        workflowId: run.workflowId,
        workflowName: run.workflow.name,
        context,
        now,
        depth,
      });
      step += 1;
      if (waitUntil) {
        await db.workflowRun.update({ where: { id: run.id }, data: { currentStep: step, nextRunAt: waitUntil } });
        return "waiting";
      }
      await db.workflowRun.update({ where: { id: run.id }, data: { currentStep: step } });
    }
    await db.workflowRun.update({ where: { id: run.id }, data: { status: "completed" } });
    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.workflowRun.update({
      where: { id: run.id },
      data: { status: "failed", lastError: message, currentStep: step },
    });
    await logActivity(db, run.contactId, "workflow_action", `Workflow "${run.workflow.name}" failed`, message);
    return "failed";
  }
}

interface ActionInput {
  type: ActionType;
  config: Record<string, unknown>;
  contactId: string;
  workflowId: string;
  workflowName: string;
  context: Record<string, unknown>;
  now: Date;
  depth: number;
}

/** Executes one action. Returns the time to resume at for a wait, else null. */
async function executeAction(db: TenantDb, input: ActionInput): Promise<Date | null> {
  const { contactId, workflowName, now, depth } = input;
  const via = `workflow "${workflowName}"`;
  const contact = await db.contact.findFirst({ where: { id: contactId } });
  if (!contact) throw new Error("Contact no longer exists");

  switch (input.type) {
    case "send_email": {
      const config = actionConfigSchemas.send_email.parse(input.config);
      await sendToContact(db, {
        contact,
        channel: "email",
        subject: config.subject,
        body: config.body,
        source: "workflow",
        sourceId: input.workflowId,
        via,
      });
      return null;
    }
    case "send_sms": {
      const config = actionConfigSchemas.send_sms.parse(input.config);
      await sendToContact(db, { contact, channel: "sms", body: config.body, source: "workflow", sourceId: input.workflowId, via });
      return null;
    }
    case "add_tag": {
      const config = actionConfigSchemas.add_tag.parse(input.config);
      const added = await attachTag(db, contactId, config.tag);
      await logActivity(
        db,
        contactId,
        "tag_added",
        added ? `Tag "${added}" added` : `Tag "${config.tag}" already present`,
        `via ${via}`,
      );
      if (added) await emitTrigger(db, { type: "contact_tag_added", contactId, tag: added }, { now, depth: depth + 1 });
      return null;
    }
    case "remove_tag": {
      const config = actionConfigSchemas.remove_tag.parse(input.config);
      const removed = await detachTag(db, contactId, config.tag);
      await logActivity(
        db,
        contactId,
        "tag_removed",
        removed ? `Tag "${removed}" removed` : `Tag "${config.tag}" was not present`,
        `via ${via}`,
      );
      return null;
    }
    case "create_task": {
      const config = actionConfigSchemas.create_task.parse(input.config);
      const dueAt = config.dueInDays !== undefined ? new Date(now.getTime() + waitToMs(config.dueInDays, "days")) : null;
      await db.task.create({ data: { subAccountId: db.$subAccountId, contactId, title: config.title, dueAt } });
      await logActivity(db, contactId, "task_created", `Task created: ${config.title}`, `via ${via}`);
      return null;
    }
    case "move_opportunity": {
      const config = actionConfigSchemas.move_opportunity.parse(input.config);
      // Prefer the opportunity that triggered the run; otherwise the contact's
      // most recent open opportunity in the target pipeline.
      const triggered = typeof input.context.opportunityId === "string" ? input.context.opportunityId : null;
      const opportunity =
        (triggered &&
          (await db.opportunity.findFirst({ where: { id: triggered, contactId, pipelineId: config.pipelineId } }))) ||
        (await db.opportunity.findFirst({
          where: { contactId, pipelineId: config.pipelineId, status: "open" },
          orderBy: { createdAt: "desc" },
        }));
      if (!opportunity) {
        await logActivity(db, contactId, "workflow_action", "Move opportunity skipped", `No open opportunity in that pipeline (${via})`);
        return null;
      }
      const change = await applyStageChange(db, opportunity.id, config.stageId, via);
      if (change) {
        await emitTrigger(db, { type: "opportunity_stage_changed", ...change }, { now, depth: depth + 1 });
      }
      return null;
    }
    case "wait": {
      const config = actionConfigSchemas.wait.parse(input.config);
      const until = new Date(now.getTime() + waitToMs(config.amount, config.unit));
      await logActivity(db, contactId, "workflow_action", `Waiting ${formatWait(config.amount, config.unit)}`, `via ${via}`);
      return until;
    }
    default:
      throw new Error(`Unknown action type "${String(input.type)}"`);
  }
}

/** Advances every run in this sub-account whose wait has elapsed. */
export async function processDueRuns(db: TenantDb, opts: { now?: Date; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const due = await db.workflowRun.findMany({
    where: { status: "active", nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: opts.limit ?? 200,
    select: { id: true },
  });
  const results: Record<AdvanceResult, number> = { waiting: 0, completed: 0, failed: 0, stopped: 0, skipped: 0 };
  for (const { id } of due) results[await advanceRun(db, id, { now })] += 1;
  return { processed: due.length, ...results };
}
