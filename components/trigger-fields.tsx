"use client";

import { useState } from "react";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES } from "@/lib/domain";
import { TRIGGER_LABELS, TRIGGER_TYPES, type TriggerType } from "@/modules/workflows/types";
import type { StageOption } from "./step-fields";
import { Field, Input, Select } from "./ui";

export function TriggerFields({
  stages,
  defaults,
}: {
  stages: StageOption[];
  defaults?: { name?: string; triggerType?: string; tag?: string; stage?: string; status?: string };
}) {
  const [type, setType] = useState<TriggerType>((defaults?.triggerType as TriggerType) ?? "contact_created");
  return (
    <div className="space-y-3">
      <Field label="Workflow name" htmlFor="wf-name">
        <Input id="wf-name" name="name" required defaultValue={defaults?.name} placeholder="New lead follow-up" />
      </Field>
      <Field label="Trigger" htmlFor="wf-trigger">
        <Select id="wf-trigger" name="triggerType" value={type} onChange={(e) => setType(e.target.value as TriggerType)}>
          {TRIGGER_TYPES.map((t) => (
            <option key={t} value={t}>
              {TRIGGER_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      {type === "contact_tag_added" ? (
        <Field label="Only when this tag is added" htmlFor="wf-tag" hint="Leave blank for any tag">
          <Input id="wf-tag" name="tag" defaultValue={defaults?.tag} placeholder="vip" />
        </Field>
      ) : null}
      {type === "opportunity_stage_changed" ? (
        <Field label="Only when moved into" htmlFor="wf-stage">
          <Select id="wf-stage" name="stage" defaultValue={defaults?.stage ?? ""}>
            <option value="">Any stage</option>
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {type === "appointment_status_changed" ? (
        <Field label="Only when status becomes" htmlFor="wf-status">
          <Select id="wf-status" name="status" defaultValue={defaults?.status ?? ""}>
            <option value="">Any status</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPOINTMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </div>
  );
}
