"use client";

import { useState } from "react";
import { WAIT_UNITS } from "@/lib/domain";
import { ACTION_LABELS, ACTION_TYPES, type ActionType } from "@/modules/workflows/types";
import { Field, Input, Select, Textarea } from "./ui";

const MERGE_HINT = "Merge fields: {{first_name}}, {{last_name}}, {{full_name}}, {{email}}, {{phone}}, {{company}}, {{custom.key}}";

function MessageFields({ withSubject }: { withSubject: boolean }) {
  return (
    <>
      {withSubject ? (
        <Field label="Subject" htmlFor="step-subject">
          <Input id="step-subject" name="subject" required placeholder="Welcome, {{first_name}}!" />
        </Field>
      ) : null}
      <Field label="Message" htmlFor="step-body" hint={MERGE_HINT}>
        <Textarea id="step-body" name="body" rows={4} required placeholder="Hi {{first_name}}, thanks for reaching out..." />
      </Field>
    </>
  );
}

function WaitFields({ amountName, unitName }: { amountName: string; unitName: string }) {
  return (
    <div className="flex gap-2">
      <Field label="Wait" htmlFor="step-amount">
        <Input id="step-amount" name={amountName} type="number" min={1} defaultValue={1} required className="w-24" />
      </Field>
      <Field label="Unit" htmlFor="step-unit">
        <Select id="step-unit" name={unitName} defaultValue="days">
          {WAIT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/** Fields for a campaign step (email / sms / wait). */
export function CampaignStepFields() {
  const [type, setType] = useState("email");
  return (
    <div className="space-y-3">
      <Field label="Step type" htmlFor="step-type">
        <Select id="step-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="email">Send email</option>
          <option value="sms">Send SMS</option>
          <option value="wait">Wait</option>
        </Select>
      </Field>
      {type === "wait" ? <WaitFields amountName="waitAmount" unitName="waitUnit" /> : <MessageFields withSubject={type === "email"} />}
    </div>
  );
}

export interface StageOption {
  value: string; // "pipelineId:stageId"
  label: string;
}

/** Fields for a workflow action. */
export function WorkflowActionFields({ stages }: { stages: StageOption[] }) {
  const [type, setType] = useState<ActionType>("send_email");
  return (
    <div className="space-y-3">
      <Field label="Action" htmlFor="action-type">
        <Select id="action-type" name="type" value={type} onChange={(e) => setType(e.target.value as ActionType)}>
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTION_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      {type === "send_email" ? <MessageFields withSubject /> : null}
      {type === "send_sms" ? <MessageFields withSubject={false} /> : null}
      {type === "add_tag" || type === "remove_tag" ? (
        <Field label="Tag" htmlFor="action-tag">
          <Input id="action-tag" name="tag" required placeholder="vip" />
        </Field>
      ) : null}
      {type === "create_task" ? (
        <div className="flex gap-2">
          <Field label="Task title" htmlFor="action-title">
            <Input id="action-title" name="title" required placeholder="Call {{first_name}}" />
          </Field>
          <Field label="Due in (days)" htmlFor="action-due">
            <Input id="action-due" name="dueInDays" type="number" min={0} className="w-24" />
          </Field>
        </div>
      ) : null}
      {type === "move_opportunity" ? (
        <Field label="Move to stage" htmlFor="action-stage" hint="Moves the opportunity that triggered the workflow, or the contact's latest open one in that pipeline.">
          <Select id="action-stage" name="stage" required>
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {type === "wait" ? <WaitFields amountName="amount" unitName="unit" /> : null}
    </div>
  );
}
