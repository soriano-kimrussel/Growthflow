import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Timeline } from "@/components/timeline";
import { Badge, ButtonLink, Card, contactName, EmptyState, Input, PageHeader, Select, statusTone, Textarea } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/domain";
import { formatCents } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { enrollContactAction } from "@/modules/campaigns/actions";
import { addNoteAction, collectPaymentAction, deleteContactAction } from "@/modules/contacts/actions";
import { getContact } from "@/modules/contacts/service";
import { createTaskAction, toggleTaskAction } from "@/modules/tasks/actions";
import { listTimeline } from "@/modules/timeline/service";

export const metadata = { title: "Contact" };

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const { db, subAccount, role } = await requireTenant();
  const tz = subAccount.timezone;
  const contact = await getContact(db, id);
  if (!contact) notFound();
  const [timeline, campaigns] = await Promise.all([
    listTimeline(db, contact.id),
    db.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }),
  ]);
  const custom = Object.entries(JSON.parse(contact.customFields) as Record<string, string>);
  const enrolledIds = new Set(contact.enrollments.map((e) => e.campaignId));

  return (
    <>
      <PageHeader
        title={contactName(contact)}
        description={
          <span className="flex flex-wrap items-center gap-1">
            {contact.company ? <span className="mr-1">{contact.company}</span> : null}
            {contact.tags.map((t) => (
              <Badge key={t.id} tone="indigo">
                {t.tag.name}
              </Badge>
            ))}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/contacts/${contact.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            {can(role, "contacts:delete") ? (
              <ActionButton action={deleteContactAction.bind(null, contact.id)} variant="danger" size="md" confirm="Delete this contact and all of its history?">
                Delete
              </ActionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="Details">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Detail label="Email" value={contact.email} />
              <Detail label="Phone" value={contact.phone} />
              <Detail label="Company" value={contact.company} />
              <Detail label="Created" value={formatDate(contact.createdAt, tz)} />
              {custom.map(([k, v]) => (
                <Detail key={k} label={k} value={v} />
              ))}
            </dl>
          </Card>

          <Card title="Add a note">
            <ActionForm action={addNoteAction.bind(null, contact.id)} resetOnSuccess className="space-y-2">
              <Textarea name="body" rows={3} placeholder="Called and left a voicemail..." required aria-label="Note" />
              <SubmitButton size="sm">Add note</SubmitButton>
            </ActionForm>
            {contact.notes.length ? (
              <ul className="mt-4 space-y-3">
                {contact.notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="whitespace-pre-line text-slate-800">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {n.authorName} · {formatDateTime(n.createdAt, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card title="Opportunities" actions={<Link href="/opportunities" className="text-xs text-indigo-600">Board</Link>}>
            {contact.opportunities.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {contact.opportunities.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">{o.title}</span>{" "}
                      <span className="text-slate-500">
                        · {o.pipeline.name} / {o.stage.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                      {formatCents(o.value)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No opportunities" />
            )}
          </Card>

          <Card title="Appointments" actions={<Link href="/calendar" className="text-xs text-indigo-600">Book</Link>}>
            {contact.appointments.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {contact.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">{a.title}</span> <span className="text-slate-500">· {formatDateTime(a.startAt, tz)}</span>
                    </span>
                    <Badge tone={statusTone(a.status)}>{APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No appointments" />
            )}
          </Card>

          <Card title="Tasks">
            <ActionForm action={createTaskAction.bind(null, contact.id)} resetOnSuccess className="flex flex-wrap gap-2">
              <Input name="title" placeholder="Follow up about pricing" required className="min-w-0 flex-1" aria-label="Task title" />
              <Input name="dueDate" type="date" className="w-40" aria-label="Due date" />
              <SubmitButton size="sm">Add task</SubmitButton>
            </ActionForm>
            {contact.tasks.length ? (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {contact.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2">
                    <span className={t.completedAt ? "text-slate-400 line-through" : ""}>
                      {t.title}
                      {t.dueAt ? <span className="ml-2 text-xs text-slate-500">due {formatDate(t.dueAt, tz)}</span> : null}
                    </span>
                    <ActionButton action={toggleTaskAction.bind(null, t.id, !t.completedAt)}>{t.completedAt ? "Reopen" : "Complete"}</ActionButton>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Campaigns">
              {contact.enrollments.length ? (
                <ul className="mb-3 space-y-1 text-sm">
                  {contact.enrollments.map((e) => (
                    <li key={e.id} className="flex items-center justify-between">
                      <Link href={`/campaigns/${e.campaignId}`} className="hover:underline">
                        {e.campaign.name}
                      </Link>
                      <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ActionForm action={enrollContactAction.bind(null, contact.id)} className="flex gap-2">
                <Select name="campaignId" required aria-label="Campaign" className="min-w-0 flex-1">
                  {campaigns
                    .filter((c) => !enrolledIds.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                </Select>
                <SubmitButton size="sm">Enroll</SubmitButton>
              </ActionForm>
            </Card>

            <Card title="Payments (simulated)">
              {contact.payments.length ? (
                <ul className="mb-3 space-y-1 text-sm">
                  {contact.payments.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{p.description}</span>
                      <span className="font-medium">{formatCents(p.amount, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {can(role, "payments:collect") ? (
                <ActionForm action={collectPaymentAction.bind(null, contact.id)} resetOnSuccess className="space-y-2">
                  <div className="flex gap-2">
                    <Input name="amount" placeholder="250.00" required inputMode="decimal" aria-label="Amount" className="w-28" />
                    <Input name="description" placeholder="Setup fee" aria-label="Description" className="min-w-0 flex-1" />
                  </div>
                  <SubmitButton size="sm">Collect payment</SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-xs text-slate-500">Admins can collect payments.</p>
              )}
            </Card>
          </div>

          {contact.workflowRuns.length ? (
            <Card title="Workflow runs">
              <ul className="space-y-1 text-sm">
                {contact.workflowRuns.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <Link href={`/workflows/${r.workflowId}`} className="hover:underline">
                      {r.workflow.name}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {r.status === "active" && r.nextRunAt ? `next step ${formatDateTime(r.nextRunAt, tz)}` : null}
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <Card title="Timeline">
            <Timeline items={timeline} timeZone={tz} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs capitalize text-slate-500">{label.replace(/_/g, " ")}</dt>
      <dd className="break-words text-slate-800">{value || "—"}</dd>
    </div>
  );
}
