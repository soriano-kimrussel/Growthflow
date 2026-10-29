import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireAgencyAdmin } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/time";
import { applySnapshotAction, createSnapshotAction, createSubAccountAction, deleteSnapshotAction } from "@/modules/agency/actions";
import { listSubAccounts } from "@/modules/agency/service";
import { parseSnapshotData } from "@/modules/snapshots/service";

export const metadata = { title: "Agency" };

const TIME_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

export default async function AgencyPage() {
  const { user } = await requireAgencyAdmin();
  const [agency, subAccounts, snapshots] = await Promise.all([
    prisma.agency.findUniqueOrThrow({ where: { id: user.agencyId } }),
    listSubAccounts(user.agencyId),
    prisma.snapshot.findMany({ where: { agencyId: user.agencyId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader title={agency.name} description="Agency admin: manage sub-accounts and snapshots." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Sub-accounts (${subAccounts.length})`}>
          {subAccounts.length ? (
            <ul className="mb-4 divide-y divide-slate-100 text-sm">
              {subAccounts.map((s) => (
                <li key={s.id} className="flex justify-between py-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-slate-500">
                    {s._count.contacts} contacts · {s._count.memberships} members · {s.timezone}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No sub-accounts yet" />
          )}
          <ActionForm action={createSubAccountAction} resetOnSuccess className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" aria-label="New sub-account">
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
            <div className="sm:col-span-2">
              <SubmitButton>Create sub-account</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Snapshots">
          <p className="mb-3 text-sm text-slate-500">
            A snapshot copies a sub-account&apos;s pipelines, campaigns and workflows (never contacts or messages) so you can stamp it onto another
            sub-account.
          </p>
          <ActionForm action={createSnapshotAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2" aria-label="Create snapshot">
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
            <div className="sm:col-span-2">
              <SubmitButton variant="secondary">Create snapshot</SubmitButton>
            </div>
          </ActionForm>

          {snapshots.length ? (
            <ul className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {snapshots.map((snap) => {
                const data = parseSnapshotData(snap.data);
                return (
                  <li key={snap.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{snap.name}</p>
                        <p className="text-xs text-slate-500">
                          {data.pipelines.length} pipeline(s) · {data.campaigns.length} campaign(s) · {data.workflows.length} workflow(s) ·{" "}
                          {formatDateTime(snap.createdAt, "UTC")} UTC
                        </p>
                      </div>
                      <ActionButton action={deleteSnapshotAction.bind(null, snap.id)} variant="ghost" confirm="Delete this snapshot?">
                        Delete
                      </ActionButton>
                    </div>
                    <ActionForm action={applySnapshotAction} className="mt-2 flex flex-wrap items-start gap-2">
                      <input type="hidden" name="snapshotId" value={snap.id} />
                      <Select name="subAccountId" className="w-56 py-1 text-xs" aria-label="Apply to sub-account">
                        {subAccounts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                      <SubmitButton size="sm">Apply snapshot</SubmitButton>
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      </div>
    </>
  );
}
