import Link from "next/link";
import { ChevronRight, Plus, Workflow, Zap } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { TriggerFields } from "@/components/trigger-fields";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionGlyph, TRIGGER_ICON } from "@/components/workflow-icons";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createWorkflowAction } from "@/modules/workflows/actions";
import { stageOptions } from "@/modules/workflows/stage-options";
import { TRIGGER_LABELS, type TriggerType } from "@/modules/workflows/types";

export const metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  const { db, role } = await requireTenant();
  const [workflows, stages] = await Promise.all([
    db.workflow.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        actions: { orderBy: { position: "asc" }, select: { id: true, type: true } },
        _count: { select: { runs: true } },
      },
    }),
    stageOptions(db),
  ]);
  const activeRuns = await db.workflowRun.groupBy({ by: ["workflowId"], where: { status: "active" }, _count: { _all: true } });
  const activeByWorkflow = new Map(activeRuns.map((r) => [r.workflowId, r._count._all]));

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Trigger → action automations. Stored in the database, advanced by a persistent runner."
        actions={<RunnerControls />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          {workflows.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {workflows.map((w) => {
                const TriggerIcon = TRIGGER_ICON[w.triggerType] ?? Zap;
                const inProgress = activeByWorkflow.get(w.id) ?? 0;
                return (
                  <li key={w.id}>
                    <Link
                      href={`/workflows/${w.id}`}
                      className="group block h-full rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-pop"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                          <TriggerIcon className="h-5 w-5" />
                        </span>
                        <Badge tone={w.active ? "green" : "slate"} dot>
                          {w.active ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <p className="mt-3 font-semibold text-slate-900 group-hover:text-brand-700">{w.name}</p>
                      <p className="text-xs text-slate-500">When: {TRIGGER_LABELS[w.triggerType as TriggerType] ?? w.triggerType}</p>
                      <div className="mt-4 flex items-center gap-1" aria-label={`${w.actions.length} actions`}>
                        {w.actions.slice(0, 7).map((a, i) => (
                          <span key={a.id} className="flex items-center gap-1">
                            {i > 0 ? <ChevronRight aria-hidden className="h-3 w-3 text-slate-300" /> : null}
                            <ActionGlyph type={a.type} size="sm" />
                          </span>
                        ))}
                        {w.actions.length > 7 ? <span className="text-xs text-slate-400">+{w.actions.length - 7}</span> : null}
                        {!w.actions.length ? <span className="text-xs text-slate-400">No actions yet</span> : null}
                      </div>
                      <div className="mt-4 flex gap-4 border-t border-line pt-3 text-xs text-slate-500">
                        <span>
                          <span className="font-semibold text-slate-900">{w.actions.length}</span> actions
                        </span>
                        <span>
                          <span className="font-semibold text-slate-900">{w._count.runs}</span> runs
                        </span>
                        <span>
                          <span className="font-semibold text-emerald-700">{inProgress}</span> in progress
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No workflows yet" icon={Workflow}>
              Create one to automate follow-ups.
            </EmptyState>
          )}
        </div>
        {can(role, "workflows:manage") ? (
          <Card title="New workflow" description="Pick a trigger; add actions next" icon={Plus}>
            <ActionForm action={createWorkflowAction} className="space-y-3" aria-label="New workflow">
              <TriggerFields stages={stages.options} />
              <SubmitButton className="w-full">Create workflow</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
