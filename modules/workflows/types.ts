import { z } from "zod";
import { APPOINTMENT_STATUSES, formatWait, WAIT_UNITS } from "@/lib/domain";

// Shared by the engine (server) and the editor UI (client), so no server
// imports in this file.

export const TRIGGER_TYPES = [
  "contact_created",
  "contact_tag_added",
  "opportunity_stage_changed",
  "appointment_booked",
  "appointment_status_changed",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  contact_created: "Contact created",
  contact_tag_added: "Contact tag added",
  opportunity_stage_changed: "Opportunity stage changed",
  appointment_booked: "Appointment booked",
  appointment_status_changed: "Appointment status changed",
};

/** Optional filters per trigger. An empty filter matches every event. */
export const triggerConfigSchemas = {
  contact_created: z.object({}),
  contact_tag_added: z.object({ tag: z.string().optional() }),
  opportunity_stage_changed: z.object({ pipelineId: z.string().optional(), stageId: z.string().optional() }),
  appointment_booked: z.object({}),
  appointment_status_changed: z.object({ status: z.enum(APPOINTMENT_STATUSES).optional() }),
} satisfies Record<TriggerType, z.ZodType>;

export type TriggerConfig = {
  tag?: string;
  pipelineId?: string;
  stageId?: string;
  status?: (typeof APPOINTMENT_STATUSES)[number];
};

export type TriggerEvent =
  | { type: "contact_created"; contactId: string }
  | { type: "contact_tag_added"; contactId: string; tag: string }
  | {
      type: "opportunity_stage_changed";
      contactId: string;
      opportunityId: string;
      pipelineId: string;
      fromStageId: string;
      toStageId: string;
    }
  | { type: "appointment_booked"; contactId: string; appointmentId: string }
  | { type: "appointment_status_changed"; contactId: string; appointmentId: string; status: string };

export const ACTION_TYPES = [
  "send_email",
  "send_sms",
  "add_tag",
  "remove_tag",
  "create_task",
  "move_opportunity",
  "wait",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  send_email: "Send email",
  send_sms: "Send SMS",
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  create_task: "Create task",
  move_opportunity: "Move opportunity to stage",
  wait: "Wait / delay",
};

export const actionConfigSchemas = {
  send_email: z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(5000) }),
  send_sms: z.object({ body: z.string().min(1).max(1600) }),
  add_tag: z.object({ tag: z.string().min(1).max(40) }),
  remove_tag: z.object({ tag: z.string().min(1).max(40) }),
  create_task: z.object({ title: z.string().min(1).max(200), dueInDays: z.number().int().min(0).max(365).optional() }),
  move_opportunity: z.object({ pipelineId: z.string().min(1), stageId: z.string().min(1) }),
  wait: z.object({ amount: z.number().int().min(1).max(10_000), unit: z.enum(WAIT_UNITS) }),
} satisfies Record<ActionType, z.ZodType>;

export type ActionConfig<T extends ActionType> = z.infer<(typeof actionConfigSchemas)[T]>;

export function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Does an event satisfy a workflow's trigger filter? */
export function matchesTrigger(triggerType: string, config: TriggerConfig, event: TriggerEvent): boolean {
  if (triggerType !== event.type) return false;
  switch (event.type) {
    case "contact_tag_added":
      return !config.tag || config.tag.toLowerCase() === event.tag;
    case "opportunity_stage_changed":
      return (
        (!config.pipelineId || config.pipelineId === event.pipelineId) &&
        (!config.stageId || config.stageId === event.toStageId)
      );
    case "appointment_status_changed":
      return !config.status || config.status === event.status;
    default:
      return true;
  }
}

/** One-line human summary of an action, for the editor and run logs. */
export function describeAction(type: string, config: Record<string, unknown>, stageNames: Record<string, string> = {}): string {
  switch (type) {
    case "send_email":
      return `Send email "${String(config.subject ?? "")}"`;
    case "send_sms":
      return `Send SMS "${String(config.body ?? "").slice(0, 40)}"`;
    case "add_tag":
      return `Add tag "${String(config.tag ?? "")}"`;
    case "remove_tag":
      return `Remove tag "${String(config.tag ?? "")}"`;
    case "create_task":
      return `Create task "${String(config.title ?? "")}"${config.dueInDays !== undefined ? ` due in ${String(config.dueInDays)}d` : ""}`;
    case "move_opportunity":
      return `Move opportunity to "${stageNames[String(config.stageId)] ?? "unknown stage"}"`;
    case "wait":
      return `Wait ${formatWait(Number(config.amount), String(config.unit))}`;
    default:
      return type;
  }
}
