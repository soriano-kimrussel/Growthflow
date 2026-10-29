import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { WorkflowActionFields } from "@/components/step-fields";
import { TriggerFields } from "@/components/trigger-fields";
import { Badge, Card, contactName, EmptyState, PageHeader, statusTone } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/time";
import {
  addWorkflowActionAction,
  deleteWorkflowAction,
  deleteWorkflowStepAction,
  moveWorkflowStepAction,
  setWorkflowActiveAction,
  updateWorkflowAction,
} from "@/modules/workflows/actions";
import { getWorkflow, listRuns } from "@/modules/workflows/service";
import { stageOptions } from "@/modules/workflows/stage-options";
import { describeAction, parseJsonObject, TRIGGER_LABELS, type TriggerConfig, type TriggerType } from "@/modules/workflows/types";

export const metadata = { title: "Workflow" };

export default async function WorkflowPage({ params }: PageProps<"/workflows/[id]">) {
  const { id } = await params;
  const { db, role, subAccount } = await requireTenant();
  const workflow = await getWorkflow(db, id);
  if (!workflow) notFound();
  const [runs, stages] = await Promise.all([listRuns(db, workflow.id), stageOptions(db)]);
  const canManage = can(role, "workflows:manage");
  const trigger = parseJsonObject(workflow.triggerConfig) as TriggerConfig;
  const triggerLabel = TRIGGER_LABELS[workflow.triggerType as TriggerType] ?? workflow.triggerType;
  const filter = trigger.tag
    ? `tag "${trigger.tag}"`
    : trigger.stageId
      ? `into ${stages.names[trigger.stageId] ?? "a removed stage"}`
      : trigger.status
        ? `status ${trigger.status}`
        : null;

  return (
    <>
      <PageHeader
        title={workflow.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={workflow.active ? "green" : "slate"}>{workflow.active ? "active" : "off"}</Badge>
            When: {triggerLabel}
            {filter ? ` (${filter})` : ""}
          </span>
        }
        actions={
          canManage ? (
            <>
              <ActionButton action={setWorkflowActiveAction.bind(null, workflow.id, !workflow.active)} variant={workflow.active ? "secondary" : "primary"} size="md">
                {workflow.active ? "Turn off" : "Turn on"}
              </ActionButton>
              <ActionButton action={deleteWorkflowAction.bind(null, workflow.id)} variant="danger" size="md" confirm="Delete this workflow and its run history?">
                Delete
              </ActionButton>
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Actions">
          {workflow.actions.length ? (
            <ol className="space-y-2">
              {workflow.actions.map((a, i) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{i + 1}.</span> {describeAction(a.type, parseJsonObject(a.config), stages.names)}
                  </span>
                  {canManage ? (
                    <span className="flex shrink-0 gap-1">
                      <ActionButton action={moveWorkflowStepAction.bind(null, workflow.id, a.id, "up")} variant="ghost" title="Move up">
                        ↑
                      </ActionButton>
                      <ActionButton action={moveWorkflowStepAction.bind(null, workflow.id, a.id, "down")} variant="ghost" title="Move down">
                        ↓
                      </ActionButton>
                      <ActionButton action={deleteWorkflowStepAction.bind(null, workflow.id, a.id)} variant="ghost" title="Delete action">
                        ✕
                      </ActionButton>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No actions yet" />
          )}
          {canManage ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ActionForm action={addWorkflowActionAction.bind(null, workflow.id)} resetOnSuccess className="space-y-3" aria-label="Add action">
                <WorkflowActionFields stages={stages.options} />
                <SubmitButton variant="secondary">Add action</SubmitButton>
              </ActionForm>
            </div>
          ) : null}
        </Card>

        <div className="space-y-6">
          {canManage ? (
            <Card title="Trigger">
              <ActionForm action={updateWorkflowAction.bind(null, workflow.id)} className="space-y-3">
                <TriggerFields
                  stages={stages.options}
                  defaults={{
                    name: workflow.name,
                    triggerType: workflow.triggerType,
                    tag: trigger.tag,
                    status: trigger.status,
                    stage: trigger.pipelineId && trigger.stageId ? `${trigger.pipelineId}:${trigger.stageId}` : "",
                  }}
                />
                <SubmitButton variant="secondary">Save trigger</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}

          <Card title="Runs" actions={<RunnerControls />}>
            {runs.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {runs.map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/contacts/${r.contact.id}`} className="hover:underline">
                        {contactName(r.contact)}
                      </Link>
                      <Badge tone={statusTone(r.status === "active" && r.nextRunAt ? "waiting" : r.status)}>
                        {r.status === "active" && r.nextRunAt ? "waiting" : r.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      step {Math.min(r.currentStep + 1, workflow.actions.length)}/{workflow.actions.length} · started {formatDateTime(r.createdAt, subAccount.timezone)}
                      {r.status === "active" && r.nextRunAt ? ` · resumes ${formatDateTime(r.nextRunAt, subAccount.timezone)}` : ""}
                    </p>
                    {r.lastError ? <p className="text-xs text-red-600">{r.lastError}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No runs yet">{workflow.active ? "Runs appear when the trigger fires." : "Turn the workflow on to start enrolling contacts."}</EmptyState>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
