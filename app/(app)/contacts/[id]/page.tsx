import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  Briefcase,
  CalendarDays,
  ChevronRight,
  CreditCard,
  ListTodo,
  Mail,
  Megaphone,
  Pencil,
  Phone,
  StickyNote,
  Target,
  Workflow,
} from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Timeline } from "@/components/timeline";
import { Avatar, Badge, ButtonLink, Card, contactName, EmptyState, Input, Select, statusTone, TagChip, Textarea } from "@/components/ui";
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
  const name = contactName(contact);
  const custom = Object.entries(JSON.parse(contact.customFields) as Record<string, string>);
  const enrolledIds = new Set(contact.enrollments.map((e) => e.campaignId));
  const openValue = contact.opportunities.filter((o) => o.status === "open").reduce((sum, o) => sum + o.value, 0);
  const paid = contact.payments.reduce((sum, p) => sum + p.amount, 0);
  const openTasks = contact.tasks.filter((t) => !t.completedAt).length;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/contacts" className="hover:text-slate-900">
          Contacts
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-900">{name}</span>
      </nav>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* Profile */}
        <div className="space-y-6 xl:col-span-3">
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="h-16 bg-gradient-to-r from-brand-500 via-violet-500 to-fuchsia-500" />
            <div className="-mt-8 px-5 pb-5">
              <Avatar name={name} size="xl" className="ring-4 ring-white" />
              <h1 className="mt-3 text-lg font-semibold text-slate-900">{name}</h1>
              {contact.company ? (
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Briefcase className="h-3.5 w-3.5" /> {contact.company}
                </p>
              ) : null}
              {contact.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {contact.tags.map((t) => (
                    <TagChip key={t.id} name={t.tag.name} />
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex gap-2">
                <ButtonLink href={`/contacts/${contact.id}/edit`} variant="secondary" size="sm">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </ButtonLink>
                {can(role, "contacts:delete") ? (
                  <ActionButton action={deleteContactAction.bind(null, contact.id)} variant="danger" confirm="Delete this contact and all of its history?">
                    Delete
                  </ActionButton>
                ) : null}
              </div>
            </div>
            <dl className="space-y-3 border-t border-line px-5 py-4 text-sm">
              <InfoRow icon={Mail} label="Email" value={contact.email} />
              <InfoRow icon={Phone} label="Phone" value={contact.phone} />
              <InfoRow icon={CalendarDays} label="Created" value={formatDate(contact.createdAt, tz)} />
            </dl>
            {custom.length ? (
              <dl className="grid grid-cols-2 gap-3 border-t border-line px-5 py-4 text-sm">
                {custom.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k.replace(/_/g, " ")}</dt>
                    <dd className="truncate text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>

          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Open deals" value={formatCents(openValue)} />
            <MiniStat label="Paid" value={formatCents(paid)} />
            <MiniStat label="Tasks" value={String(openTasks)} />
          </div>
        </div>

        {/* Work */}
        <div className="space-y-6 xl:col-span-5">
          <Card title="Notes" icon={StickyNote}>
            <ActionForm action={addNoteAction.bind(null, contact.id)} resetOnSuccess className="space-y-2">
              <Textarea name="body" rows={3} placeholder="Log a call, a meeting, anything worth remembering…" required aria-label="Note" />
              <div className="flex justify-end">
                <SubmitButton size="sm">Add note</SubmitButton>
              </div>
            </ActionForm>
            {contact.notes.length ? (
              <ul className="mt-4 space-y-2.5">
                {contact.notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-sm">
                    <p className="whitespace-pre-line text-slate-800">{n.body}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Avatar name={n.authorName} size="xs" /> {n.authorName} · {formatDateTime(n.createdAt, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card
            title="Opportunities"
            icon={Target}
            actions={
              <Link href="/opportunities" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Open board
              </Link>
            }
          >
            {contact.opportunities.length ? (
              <ul className="space-y-2">
                {contact.opportunities.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{o.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {o.pipeline.name} · {o.stage.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                      <span className="font-semibold tabular-nums text-slate-900">{formatCents(o.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No opportunities" icon={Target} />
            )}
          </Card>

          <Card
            title="Appointments"
            icon={CalendarDays}
            actions={
              <Link href="/calendar" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Book
              </Link>
            }
          >
            {contact.appointments.length ? (
              <ul className="divide-y divide-line">
                {contact.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(a.startAt, tz)}</p>
                    </div>
                    <Badge tone={statusTone(a.status)} dot>
                      {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No appointments" icon={CalendarDays} />
            )}
          </Card>

          <Card title="Tasks" icon={ListTodo}>
            <ActionForm action={createTaskAction.bind(null, contact.id)} resetOnSuccess className="flex flex-wrap gap-2">
              <Input name="title" placeholder="Follow up about pricing" required className="min-w-0 flex-1" aria-label="Task title" />
              <Input name="dueDate" type="date" className="w-40" aria-label="Due date" />
              <SubmitButton size="md">Add</SubmitButton>
            </ActionForm>
            {contact.tasks.length ? (
              <ul className="mt-3 divide-y divide-line">
                {contact.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className={t.completedAt ? "text-slate-400 line-through" : "text-slate-800"}>
                      {t.title}
                      {t.dueAt ? <span className="ml-2 text-xs text-slate-500 no-underline">due {formatDate(t.dueAt, tz)}</span> : null}
                    </span>
                    <ActionButton action={toggleTaskAction.bind(null, t.id, !t.completedAt)}>{t.completedAt ? "Reopen" : "Complete"}</ActionButton>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Campaigns" icon={Megaphone}>
              {contact.enrollments.length ? (
                <ul className="mb-3 space-y-1.5 text-sm">
                  {contact.enrollments.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2">
                      <Link href={`/campaigns/${e.campaignId}`} className="truncate text-slate-700 hover:text-brand-700">
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
                <SubmitButton size="md" variant="secondary">
                  Enroll
                </SubmitButton>
              </ActionForm>
            </Card>

            <Card title="Payments" description="Simulated provider" icon={CreditCard}>
              {contact.payments.length ? (
                <ul className="mb-3 space-y-1.5 text-sm">
                  {contact.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="truncate text-slate-600">{p.description}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{formatCents(p.amount, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {can(role, "payments:collect") ? (
                <ActionForm action={collectPaymentAction.bind(null, contact.id)} resetOnSuccess className="space-y-2">
                  <div className="flex gap-2">
                    <Input name="amount" placeholder="250.00" required inputMode="decimal" aria-label="Amount" className="w-24" />
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
            <Card title="Workflow runs" icon={Workflow}>
              <ul className="space-y-1.5 text-sm">
                {contact.workflowRuns.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link href={`/workflows/${r.workflowId}`} className="truncate text-slate-700 hover:text-brand-700">
                      {r.workflow.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {r.status === "active" && r.nextRunAt ? `resumes ${formatDateTime(r.nextRunAt, tz)}` : null}
                      <Badge tone={statusTone(r.status === "active" && r.nextRunAt ? "waiting" : r.status)}>
                        {r.status === "active" && r.nextRunAt ? "waiting" : r.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* Timeline */}
        <div className="xl:col-span-4">
          <Card title="Activity" description={`${timeline.length} event${timeline.length === 1 ? "" : "s"}`} icon={Activity} className="xl:sticky xl:top-20">
            <div className="scroll-thin xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1">
              <Timeline items={timeline} timeZone={tz} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="break-words text-slate-800">{value || "—"}</dd>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-2 py-3 shadow-card">
      <p className="truncate text-sm font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
