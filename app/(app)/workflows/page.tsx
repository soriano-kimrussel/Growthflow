import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { TriggerFields } from "@/components/trigger-fields";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createWorkflowAction } from "@/modules/workflows/actions";
import { listWorkflows } from "@/modules/workflows/service";
import { stageOptions } from "@/modules/workflows/stage-options";
import { TRIGGER_LABELS, type TriggerType } from "@/modules/workflows/types";

export const metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  const { db, role } = await requireTenant();
  const [workflows, stages] = await Promise.all([listWorkflows(db), stageOptions(db)]);
  return (
    <>
      <PageHeader
        title="Workflows"
        description="Trigger → actions automations, stored in the database and run by a persistent runner."
        actions={<RunnerControls />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {workflows.length ? (
            <ul className="divide-y divide-slate-100">
              {workflows.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <Link href={`/workflows/${w.id}`} className="font-medium text-indigo-700 hover:underline">
                      {w.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      When: {TRIGGER_LABELS[w.triggerType as TriggerType] ?? w.triggerType} · {w._count.actions} action(s) · {w._count.runs} run(s)
                    </p>
                  </div>
                  <Badge tone={w.active ? "green" : "slate"}>{w.active ? "active" : "off"}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No workflows yet" />
          )}
        </Card>
        {can(role, "workflows:manage") ? (
          <Card title="New workflow">
            <ActionForm action={createWorkflowAction} className="space-y-3" aria-label="New workflow">
              <TriggerFields stages={stages.options} />
              <SubmitButton>Create workflow</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
