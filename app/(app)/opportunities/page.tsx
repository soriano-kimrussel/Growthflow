import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { KanbanBoard } from "@/components/kanban-board";
import { Card, contactName, cx, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { contactOptions } from "@/modules/contacts/service";
import {
  addStageAction,
  createOpportunityAction,
  createPipelineAction,
  deletePipelineAction,
  deleteStageAction,
} from "@/modules/opportunities/actions";
import { getBoard, listPipelines } from "@/modules/opportunities/service";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  const { pipeline: requested } = await searchParams;
  const { db, role } = await requireTenant();
  const pipelines = await listPipelines(db);
  const selectedId = (typeof requested === "string" && pipelines.some((p) => p.id === requested) ? requested : pipelines[0]?.id) ?? null;
  const [board, contacts] = await Promise.all([selectedId ? getBoard(db, selectedId) : null, contactOptions(db)]);
  const canManage = can(role, "pipelines:manage");

  const cards =
    board?.stages.flatMap((s) =>
      s.opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        value: o.value,
        status: o.status,
        stageId: o.stageId,
        contact: { id: o.contact.id, name: contactName(o.contact) },
      })),
    ) ?? [];

  return (
    <>
      <PageHeader title="Opportunities" description="Drag deals between stages. Each move is logged on the contact and can trigger workflows." />

      {pipelines.length > 1 ? (
        <nav aria-label="Pipelines" className="mb-4 flex flex-wrap gap-2">
          {pipelines.map((p) => (
            <Link
              key={p.id}
              href={`/opportunities?pipeline=${p.id}`}
              className={cx(
                "rounded-full px-3 py-1 text-sm",
                p.id === selectedId ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {board ? (
        <>
          <KanbanBoard stages={board.stages.map((s) => ({ id: s.id, name: s.name }))} cards={cards} />

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title={`New opportunity in ${board.name}`}>
              {contacts.length ? (
                <ActionForm action={createOpportunityAction.bind(null, board.id)} resetOnSuccess className="grid gap-3 sm:grid-cols-2" aria-label="New opportunity">
                  <Field label="Title" htmlFor="opp-title">
                    <Input id="opp-title" name="title" required placeholder="Website redesign" />
                  </Field>
                  <Field label="Value ($)" htmlFor="opp-value">
                    <Input id="opp-value" name="value" inputMode="decimal" placeholder="2500" />
                  </Field>
                  <Field label="Contact" htmlFor="opp-contact">
                    <Select id="opp-contact" name="contactId" required>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {contactName(c)}
                          {c.email ? ` (${c.email})` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Stage" htmlFor="opp-stage">
                    <Select id="opp-stage" name="stageId" required>
                      {board.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <SubmitButton>Add opportunity</SubmitButton>
                  </div>
                </ActionForm>
              ) : (
                <EmptyState title="Add a contact first">
                  <Link className="text-indigo-600" href="/contacts/new">
                    Create a contact
                  </Link>
                </EmptyState>
              )}
            </Card>

            {canManage ? (
              <Card title="Pipeline settings">
                <ul className="mb-3 space-y-1 text-sm">
                  {board.stages.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>
                        {s.position + 1}. {s.name} <span className="text-xs text-slate-400">({s.opportunities.length})</span>
                      </span>
                      {s.opportunities.length === 0 && board.stages.length > 1 ? (
                        <ActionButton action={deleteStageAction.bind(null, s.id)} variant="ghost" confirm={`Delete stage "${s.name}"?`}>
                          Remove
                        </ActionButton>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <ActionForm action={addStageAction.bind(null, board.id)} resetOnSuccess className="flex gap-2">
                  <Input name="name" placeholder="New stage name" required aria-label="New stage name" />
                  <SubmitButton size="sm" variant="secondary">
                    Add stage
                  </SubmitButton>
                </ActionForm>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <ActionButton
                    action={deletePipelineAction.bind(null, board.id)}
                    variant="danger"
                    confirm={`Delete pipeline "${board.name}" and all of its opportunities?`}
                  >
                    Delete pipeline
                  </ActionButton>
                </div>
              </Card>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState title="No pipelines yet">{canManage ? "Create one below." : "Ask an admin to create one."}</EmptyState>
      )}

      {canManage ? (
        <Card title="Create a pipeline" className="mt-6 max-w-xl">
          <ActionForm action={createPipelineAction} className="space-y-3">
            <Field label="Name" htmlFor="pipe-name">
              <Input id="pipe-name" name="name" required placeholder="Onboarding" />
            </Field>
            <Field label="Stages" htmlFor="pipe-stages" hint="Comma separated, in order">
              <Input id="pipe-stages" name="stages" required defaultValue="New, In progress, Done" />
            </Field>
            <SubmitButton variant="secondary">Create pipeline</SubmitButton>
          </ActionForm>
        </Card>
      ) : null}
    </>
  );
}
