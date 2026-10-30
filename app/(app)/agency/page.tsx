import { ArrowRightLeft, Building2, Copy, Globe, Layers, LayoutTemplate, Megaphone, Plus, Trash2, Users, Workflow } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { buttonClass, Card, cx, EmptyState, Field, initials, Input, PageHeader, Select, StatCard, swatch } from "@/components/ui";
import { requireAgencyAdmin } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/time";
import { applySnapshotAction, createSnapshotAction, createSubAccountAction, deleteSnapshotAction } from "@/modules/agency/actions";
import { listSubAccounts } from "@/modules/agency/service";
import { switchSubAccountAction } from "@/modules/auth/actions";
import { parseSnapshotData } from "@/modules/snapshots/service";

export const metadata = { title: "Agency" };

const TIME_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

const TEMPLATE_GRADIENTS = [
  "from-brand-500 to-violet-500",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-pink-500 to-rose-400",
];

export default async function AgencyPage() {
  const { user } = await requireAgencyAdmin();
  const [agency, subAccounts, snapshots] = await Promise.all([
    prisma.agency.findUniqueOrThrow({ where: { id: user.agencyId } }),
    listSubAccounts(user.agencyId),
    prisma.snapshot.findMany({ where: { agencyId: user.agencyId }, orderBy: { createdAt: "desc" } }),
  ]);
  const totalContacts = subAccounts.reduce((sum, s) => sum + s._count.contacts, 0);
  const nameById = new Map(subAccounts.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader eyebrow="Agency" title={agency.name} description="Client workspaces, provisioning and reusable snapshots." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Client workspaces" value={subAccounts.length} icon={Building2} tone="brand" />
        <StatCard label="Contacts across clients" value={totalContacts.toLocaleString("en-US")} icon={Users} tone="sky" />
        <StatCard label="Snapshots" value={snapshots.length} icon={LayoutTemplate} tone="violet" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Client workspaces</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subAccounts.map((s) => (
          <article key={s.id} className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className={cx("flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-inset", swatch(s.name))}>{initials(s.name)}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{s.name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Globe className="h-3 w-3" /> {s.timezone}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-[11px] text-slate-500">Contacts</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{s._count.contacts}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-[11px] text-slate-500">Members</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{s._count.memberships}</dd>
              </div>
            </dl>
            <form action={switchSubAccountAction} className="mt-4">
              <input type="hidden" name="subAccountId" value={s.id} />
              <button className={cx(buttonClass("soft"), "w-full")}>
                <ArrowRightLeft className="h-4 w-4" /> Switch to workspace
              </button>
            </form>
          </article>
        ))}

        <article className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <Plus className="h-4 w-4" /> New client workspace
          </p>
          <p className="mb-3 text-xs text-slate-500">Starts with a default sales pipeline.</p>
          <ActionForm action={createSubAccountAction} resetOnSuccess className="space-y-3" aria-label="New sub-account">
            <Field label="Name" htmlFor="sa-name">
              <Input id="sa-name" name="name" required placeholder="Client business name" />
            </Field>
            <Field label="Time zone" htmlFor="sa-tz">
              <Select id="sa-tz" name="timezone" defaultValue="America/New_York">
                {TIME_ZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton className="w-full">Create sub-account</SubmitButton>
          </ActionForm>
        </article>
      </div>

      <div className="mb-3 mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Snapshot templates</h2>
          <p className="text-xs text-slate-500">Pipelines, campaigns and workflows; never contacts or messages.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          {snapshots.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {snapshots.map((snap, index) => {
                const data = parseSnapshotData(snap.data);
                const resources = [
                  { icon: Layers, label: "Pipelines", items: data.pipelines.map((p) => `${p.name} (${p.stages.length} stages)`) },
                  { icon: Megaphone, label: "Campaigns", items: data.campaigns.map((c) => `${c.name} (${c.steps.length} steps)`) },
                  { icon: Workflow, label: "Workflows", items: data.workflows.map((w) => `${w.name} (${w.actions.length} actions)`) },
                ];
                return (
                  <li key={snap.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                    <div className={cx("flex h-20 items-end justify-between bg-gradient-to-br p-4", TEMPLATE_GRADIENTS[index % TEMPLATE_GRADIENTS.length])}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-sm">
                        <LayoutTemplate className="h-5 w-5" />
                      </span>
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">v{data.version}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{snap.name}</p>
                          <p className="text-xs text-slate-500">
                            From {snap.sourceSubAccountId ? (nameById.get(snap.sourceSubAccountId) ?? "a removed workspace") : "unknown"} · {formatDate(snap.createdAt, "UTC")}
                          </p>
                        </div>
                        <ActionButton action={deleteSnapshotAction.bind(null, snap.id)} variant="ghost" confirm="Delete this snapshot?" title="Delete snapshot">
                          <Trash2 className="h-3.5 w-3.5" />
                        </ActionButton>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {resources.map((r) => (
                          <span key={r.label} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <r.icon className="h-3 w-3" /> {r.items.length} {r.label.toLowerCase().replace(/s$/, r.items.length === 1 ? "" : "s")}
                          </span>
                        ))}
                      </div>
                      <details className="mt-3 text-xs text-slate-600">
                        <summary className="cursor-pointer font-medium text-brand-600 hover:text-brand-700">Preview included resources</summary>
                        <div className="mt-2 space-y-2">
                          {resources.map((r) =>
                            r.items.length ? (
                              <div key={r.label}>
                                <p className="font-semibold text-slate-500">{r.label}</p>
                                <ul className="list-inside list-disc text-slate-600">
                                  {r.items.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null,
                          )}
                        </div>
                      </details>
                      <ActionForm action={applySnapshotAction} className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <input type="hidden" name="snapshotId" value={snap.id} />
                        <Select name="subAccountId" className="min-w-0 flex-1 py-1.5 text-xs" aria-label="Apply to sub-account">
                          {subAccounts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton size="md">
                          <Copy className="h-3.5 w-3.5" /> Clone in
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No snapshots yet" icon={LayoutTemplate}>
              Capture a workspace&apos;s setup to reuse it for new clients.
            </EmptyState>
          )}
        </div>

        <Card title="Create snapshot" description="Capture a workspace's structure" icon={Plus}>
          <ActionForm action={createSnapshotAction} resetOnSuccess className="space-y-3" aria-label="Create snapshot">
            <Field label="From sub-account" htmlFor="snap-source">
              <Select id="snap-source" name="subAccountId" required>
                {subAccounts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Snapshot name" htmlFor="snap-name">
              <Input id="snap-name" name="name" placeholder="Dental clinic starter" />
            </Field>
            <SubmitButton className="w-full">Create snapshot</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
