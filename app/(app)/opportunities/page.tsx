import Link from "next/link";
import { DollarSign, Layers, Plus, Settings2, Target, TrendingUp, Trophy } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { KanbanBoard } from "@/components/kanban-board";
import { Card, contactName, EmptyState, Field, IconTile, Input, PageHeader, PillTabs, Select } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatCents } from "@/lib/money";
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

const DAY = 86_400_000;

export default async function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  const { pipeline: requested } = await searchParams;
  const { db, role } = await requireTenant();
  const pipelines = await listPipelines(db);
  const selectedId = (typeof requested === "string" && pipelines.some((p) => p.id === requested) ? requested : pipelines[0]?.id) ?? null;
  const [board, contacts] = await Promise.all([selectedId ? getBoard(db, selectedId) : null, contactOptions(db)]);
  const canManage = can(role, "pipelines:manage");
  const now = new Date().getTime();

  const cards =
    board?.stages.flatMap((s) =>
      s.opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        value: o.value,
        status: o.status,
        stageId: o.stageId,
        ageDays: Math.max(0, Math.floor((now - o.updatedAt.getTime()) / DAY)),
        contact: { id: o.contact.id, name: contactName(o.contact) },
      })),
    ) ?? [];
  const open = cards.filter((c) => c.status === "open");
  const won = cards.filter((c) => c.status === "won");
  const openValue = open.reduce((sum, c) => sum + c.value, 0);
  const summary = [
    { label: "Open pipeline", value: formatCents(openValue), icon: DollarSign, tone: "brand" as const },
    { label: "Open deals", value: String(open.length), icon: Target, tone: "sky" as const },
    { label: "Average deal", value: formatCents(open.length ? Math.round(openValue / open.length) : 0), icon: TrendingUp, tone: "violet" as const },
    { label: "Won", value: `${won.length} · ${formatCents(won.reduce((s, c) => s + c.value, 0))}`, icon: Trophy, tone: "green" as const },
  ];

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Drag deals between stages. Every move is logged on the contact's timeline and can trigger workflows."
        actions={
          board && contacts.length ? (
            <a href="#new-opportunity" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              <Plus className="h-4 w-4" /> New opportunity
            </a>
          ) : null
        }
      />

      {pipelines.length > 1 ? (
        <div className="mb-4">
          <PillTabs label="Pipelines" items={pipelines.map((p) => ({ href: `/opportunities?pipeline=${p.id}`, label: p.name, active: p.id === selectedId }))} />
        </div>
      ) : null}

      {board ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-card">
                <IconTile icon={s.icon} tone={s.tone} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="truncate text-base font-semibold tabular-nums text-slate-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <KanbanBoard stages={board.stages.map((s) => ({ id: s.id, name: s.name }))} cards={cards} />

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div id="new-opportunity" className="scroll-mt-20">
              <Card title={`New opportunity in ${board.name}`} icon={Plus}>
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
                  <EmptyState title="Add a contact first" icon={Target}>
                    <Link className="text-brand-600" href="/contacts/new">
                      Create a contact
                    </Link>
                  </EmptyState>
                )}
              </Card>
            </div>

            {canManage ? (
              <Card title="Pipeline settings" description={board.name} icon={Settings2}>
                <ol className="mb-4 space-y-1.5">
                  {board.stages.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-slate-500 ring-1 ring-line">
                          {s.position + 1}
                        </span>
                        {s.name}
                        <span className="text-xs text-slate-400">({s.opportunities.length})</span>
                      </span>
                      {s.opportunities.length === 0 && board.stages.length > 1 ? (
                        <ActionButton action={deleteStageAction.bind(null, s.id)} variant="ghost" confirm={`Delete stage "${s.name}"?`}>
                          Remove
                        </ActionButton>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <ActionForm action={addStageAction.bind(null, board.id)} resetOnSuccess className="flex gap-2">
                  <Input name="name" placeholder="New stage name" required aria-label="New stage name" />
                  <SubmitButton variant="secondary">Add stage</SubmitButton>
                </ActionForm>
                <div className="mt-4 flex justify-end border-t border-line pt-4">
                  <ActionButton action={deletePipelineAction.bind(null, board.id)} variant="danger" confirm={`Delete pipeline "${board.name}" and all of its opportunities?`}>
                    Delete pipeline
                  </ActionButton>
                </div>
              </Card>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState title="No pipelines yet" icon={Layers}>
          {canManage ? "Create one below." : "Ask an admin to create one."}
        </EmptyState>
      )}

      {canManage ? (
        <Card title="Create a pipeline" icon={Layers} className="mt-6 max-w-xl">
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
