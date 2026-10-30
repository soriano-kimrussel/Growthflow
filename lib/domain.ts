// Shared enumerations. The schema stores these as strings (portable across
// SQLite and Postgres); these lists are the source of truth for validation.

export const OPPORTUNITY_STATUSES = ["open", "won", "lost", "abandoned"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const APPOINTMENT_STATUSES = ["booked", "showed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  showed: "Showed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export const CAMPAIGN_STATUSES = ["draft", "active", "paused"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const STEP_TYPES = ["email", "sms", "wait"] as const;
export type CampaignStepType = (typeof STEP_TYPES)[number];

export const WAIT_UNITS = ["minutes", "hours", "days"] as const;
export type WaitUnit = (typeof WAIT_UNITS)[number];

export const RUN_STATUSES = ["active", "completed", "failed", "stopped"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const ACTIVITY_TYPES = [
  "contact_created",
  "contact_updated",
  "note_added",
  "tag_added",
  "tag_removed",
  "stage_changed",
  "opportunity_created",
  "message_sent",
  "appointment_booked",
  "appointment_status_changed",
  "task_created",
  "workflow_action",
  "campaign",
  "payment",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function waitToMs(amount: number, unit: WaitUnit): number {
  const unitMs = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
  return amount * unitMs;
}

/** "1 day", "3 hours" — wait durations for display. */
export function formatWait(amount: number, unit: string): string {
  return `${amount} ${amount === 1 ? unit.replace(/s$/, "") : unit}`;
}

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}
