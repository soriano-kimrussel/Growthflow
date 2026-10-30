import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, CircleStop, History, Plus, Settings2, Trash2, Zap } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { WorkflowActionFields } from "@/components/step-fields";
import { TriggerFields } from "@/components/trigger-fields";
import { Avatar, Badge, Card, contactName, EmptyState, statusTone } from "@/components/ui";
import { ActionGlyph, TRIGGER_ICON } from "@/components/workflow-icons";
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
import { ACTION_LABELS, describeAction, parseJsonObject, TRIGGER_LABELS, type ActionType, type TriggerConfig, type TriggerType } from "@/modules/workflows/types";

export const metadata = { title: "Workflow" };

function Connector({ addHref }: { addHref?: string }) {
  return (
    <div aria-hidden className="relative flex h-10 justify-center">
      <span className="w-px bg-slate-300" />
      {addHref ? (
        <a
          href={addHref}
          tabIndex={-1}
          className="absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400 shadow-sm hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

export default async function WorkflowPage({ params }: PageProps<"/workflows/[id]">) {
  const { id } = await params;
  const { db, role, subAccount } = await requireTenant();
  const workflow = await getWorkflow(db, id);
  if (!workflow) notFound();
  const [runs, stages] = await Promise.all([listRuns(db, workflow.id), stageOptions(db)]);
  const canManage = can(role, "workflows:manage");
  const tz = subAccount.timezone;
  const trigger = parseJsonObject(workflow.triggerConfig) as TriggerConfig;
  const triggerLabel = TRIGGER_LABELS[workflow.triggerType as TriggerType] ?? workflow.triggerType;
  const TriggerIcon = TRIGGER_ICON[workflow.triggerType] ?? Zap;
  const filter = trigger.tag
    ? `Tag is "${trigger.tag}"`
    : trigger.stageId
      ? `Moved into ${stages.names[trigger.stageId] ?? "a removed stage"}`
      : trigger.status
        ? `Status becomes ${trigger.status.replace("_", "-")}`
        : "Any";

  // Contacts currently parked at each wait step (run resumes after step i).
  const waitingAt = new Map<number, number>();
  for (const r of runs) {
    if (r.status === "active" && r.nextRunAt && r.currentStep > 0) waitingAt.set(r.currentStep - 1, (waitingAt.get(r.currentStep - 1) ?? 0) + 1);
  }
  const counts = {
    active: runs.filter((r) => r.status === "active").length,
    completed: runs.filter((r) => r.status === "completed").length,
    failed: runs.filter((r) => r.status === "failed").length,
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/workflows" className="hover:text-slate-900">
          Workflows
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-900">{workflow.name}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{workflow.name}</h1>
          <Badge tone={workflow.active ? "green" : "slate"} dot>
            {workflow.active ? "Published" : "Draft"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <RunnerControls />
          {canManage ? (
            <>
              <ActionButton action={setWorkflowActiveAction.bind(null, workflow.id, !workflow.active)} variant={workflow.active ? "secondary" : "primary"} size="md">
                {workflow.active ? "Turn off" : "Turn on"}
              </ActionButton>
              <ActionButton action={deleteWorkflowAction.bind(null, workflow.id)} variant="danger" size="md" confirm="Delete this workflow and its run history?">
                <Trash2 className="h-4 w-4" />
              </ActionButton>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Canvas */}
        <section aria-label="Workflow canvas" className="canvas-dots relative min-h-[32rem] overflow-hidden rounded-2xl border border-line">
          <div className="absolute left-4 top-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 shadow-card ring-1 ring-line">{workflow.actions.length} actions</span>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-emerald-700 shadow-card ring-1 ring-line">{counts.active} in progress</span>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 shadow-card ring-1 ring-line">{counts.completed} completed</span>
            {counts.failed ? <span className="rounded-full bg-white px-2.5 py-1 font-medium text-red-600 shadow-card ring-1 ring-line">{counts.failed} failed</span> : null}
          </div>

          <div className="flex flex-col items-center px-4 pb-10 pt-16">
            {/* Trigger node */}
            <div className="w-full max-w-sm rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-pop">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                  <TriggerIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Trigger</p>
                  <p className="truncate font-semibold text-slate-900">{triggerLabel}</p>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">Filter: {filter}</p>
            </div>

            {workflow.actions.map((a, i) => {
              const config = parseJsonObject(a.config);
              const parked = waitingAt.get(i) ?? 0;
              const isWait = a.type === "wait";
              return (
                <div key={a.id} className="flex w-full flex-col items-center">
                  <Connector addHref={canManage ? "#add-action" : undefined} />
                  <div
                    className={
                      isWait
                        ? "flex w-full max-w-xs items-center gap-3 rounded-full border border-dashed border-slate-300 bg-white/90 py-2 pl-2 pr-3 shadow-card"
                        : "w-full max-w-sm rounded-2xl border border-line bg-white p-3.5 shadow-card transition-shadow hover:shadow-pop"
                    }
                  >
                    <div className="flex items-center gap-3">
                      <ActionGlyph type={a.type} size={isWait ? "sm" : "md"} />
                      <div className="min-w-0 flex-1">
                        {!isWait ? (
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Step {i + 1} · {ACTION_LABELS[a.type as ActionType] ?? a.type}
                          </p>
                        ) : null}
                        <p className={isWait ? "text-sm font-medium text-slate-700" : "truncate text-sm font-semibold text-slate-900"}>
                          {describeAction(a.type, config, stages.names)}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 items-center">
                          <ActionButton action={moveWorkflowStepAction.bind(null, workflow.id, a.id, "up")} variant="ghost" title="Move up">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </ActionButton>
                          <ActionButton action={moveWorkflowStepAction.bind(null, workflow.id, a.id, "down")} variant="ghost" title="Move down">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </ActionButton>
                          <ActionButton action={deleteWorkflowStepAction.bind(null, workflow.id, a.id)} variant="ghost" title="Delete action">
                            <Trash2 className="h-3.5 w-3.5" />
                          </ActionButton>
                        </div>
                      ) : null}
                    </div>
                    {a.type === "send_email" && typeof config.body === "string" ? (
                      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                        <p className="line-clamp-2">{config.body}</p>
                      </div>
                    ) : null}
                  </div>
                  {parked ? (
                    <span className="mt-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      {parked} contact{parked === 1 ? "" : "s"} waiting here
                    </span>
                  ) : null}
                </div>
              );
            })}

            <Connector />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <CircleStop className="h-3.5 w-3.5" /> End
            </span>
            {!workflow.actions.length ? <p className="mt-4 text-sm text-slate-500">Add the first action from the panel.</p> : null}
          </div>
        </section>

        {/* Configuration drawer */}
        <aside className="space-y-6">
          {canManage ? (
            <>
              <div id="add-action" className="scroll-mt-20">
                <Card title="Add action" description="Appended after the last step" icon={Plus}>
                  <ActionForm action={addWorkflowActionAction.bind(null, workflow.id)} resetOnSuccess className="space-y-3" aria-label="Add action">
                    <WorkflowActionFields stages={stages.options} />
                    <SubmitButton className="w-full">Add action</SubmitButton>
                  </ActionForm>
                </Card>
              </div>
              <Card title="Trigger settings" icon={Settings2}>
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
                  <SubmitButton variant="secondary" className="w-full">
                    Save trigger
                  </SubmitButton>
                </ActionForm>
              </Card>
            </>
          ) : (
            <Card title="Read-only">
              <p className="text-sm text-slate-500">Only admins can edit workflows.</p>
            </Card>
          )}
        </aside>
      </div>

      {/* Execution log */}
      <Card title="Execution log" description={`Latest ${runs.length} run${runs.length === 1 ? "" : "s"}`} icon={History} className="mt-6">
        {runs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Progress</th>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2">Next / error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => {
                  const waiting = r.status === "active" && r.nextRunAt;
                  const done = Math.min(r.currentStep, workflow.actions.length);
                  return (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-4">
                        <Link href={`/contacts/${r.contact.id}`} className="flex items-center gap-2 font-medium text-slate-900 hover:text-brand-700">
                          <Avatar name={contactName(r.contact)} size="xs" />
                          {contactName(r.contact)}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={statusTone(waiting ? "waiting" : r.status)} dot>
                          {waiting ? "waiting" : r.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex gap-0.5">
                            {workflow.actions.map((a, i) => (
                              <span key={a.id} className={`h-1.5 w-3 rounded-full ${i < done ? "bg-brand-500" : "bg-slate-200"}`} />
                            ))}
                          </span>
                          {done}/{workflow.actions.length}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500">{formatDateTime(r.createdAt, tz)}</td>
                      <td className="py-2.5 text-xs">
                        {r.lastError ? (
                          <span className="text-red-600">{r.lastError}</span>
                        ) : waiting && r.nextRunAt ? (
                          <span className="text-slate-500">resumes {formatDateTime(r.nextRunAt, tz)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No runs yet" icon={History}>
            {workflow.active ? "Runs appear when the trigger fires." : "Turn the workflow on to start enrolling contacts."}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
