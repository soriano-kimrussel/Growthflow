import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar, Badge, buttonClass, Card, contactName, cx, EmptyState, Field, Input, PageHeader, Select, statusTone } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/domain";
import { formatDateTime, formatTime, toWallTime, zonedDateKey, zonedWallTimeToUtc } from "@/lib/time";
import { bookAppointmentAction, setAppointmentStatusAction } from "@/modules/appointments/actions";
import { listAppointments } from "@/modules/appointments/service";
import { contactOptions } from "@/modules/contacts/service";

export const metadata = { title: "Calendar" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

const EVENT_STYLE: Record<string, string> = {
  booked: "bg-brand-50 text-brand-800 border-l-brand-500",
  showed: "bg-emerald-50 text-emerald-800 border-l-emerald-500",
  no_show: "bg-rose-50 text-rose-800 border-l-rose-500",
  cancelled: "bg-slate-100 text-slate-400 line-through border-l-slate-300",
};

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { month: monthParam } = await searchParams;
  const { db, subAccount } = await requireTenant();
  const tz = subAccount.timezone;
  const now = new Date();
  const today = zonedDateKey(now, tz);

  const match = typeof monthParam === "string" ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null;
  const year = match ? Number(match[1]) : Number(today.slice(0, 4));
  const month = match ? Number(match[2]) : Number(today.slice(5, 7)); // 1-12
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const from = zonedWallTimeToUtc(`${year}-${pad(month)}-01T00:00`, tz);
  const to = zonedWallTimeToUtc(`${next.y}-${pad(next.m)}-01T00:00`, tz);

  const [appointments, contacts] = await Promise.all([listAppointments(db, { from, to }), contactOptions(db)]);
  const byDay = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const key = zonedDateKey(a.startAt, tz);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const defaultStart = toWallTime(new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000 + 86_400_000), tz);
  const counts = APPOINTMENT_STATUSES.map((s) => ({ status: s, count: appointments.filter((a) => a.status === s).length }));

  return (
    <>
      <PageHeader title="Calendar" description={`All times in ${tz}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{monthLabel}</h2>
              <div className="hidden gap-1.5 sm:flex">
                {counts.map((c) => (
                  <Badge key={c.status} tone={statusTone(c.status)}>
                    {c.count} {APPOINTMENT_STATUS_LABELS[c.status]}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link className={buttonClass("secondary", "sm")} href={`/calendar?month=${prev.y}-${pad(prev.m)}`} aria-label="Previous month">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Link>
              <Link className={buttonClass("secondary", "sm")} href="/calendar">
                Today
              </Link>
              <Link className={buttonClass("secondary", "sm")} href={`/calendar?month=${next.y}-${pad(next.m)}`} aria-label="Next month">
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </header>
          <div className="grid grid-cols-7 border-b border-line bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-3 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const key = day ? `${year}-${pad(month)}-${pad(day)}` : `empty-${i}`;
              const items = day ? (byDay.get(key) ?? []) : [];
              const isToday = key === today;
              return (
                <div key={key} className={cx("min-h-28 border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0", !day && "bg-slate-50/60")}>
                  {day ? (
                    <span
                      className={cx(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday ? "bg-brand-600 text-white" : "text-slate-600",
                      )}
                    >
                      {day}
                    </span>
                  ) : null}
                  <ul className="mt-1 space-y-1">
                    {items.slice(0, 3).map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/contacts/${a.contact.id}`}
                          title={`${a.title} · ${contactName(a.contact)} · ${APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}`}
                          className={cx("block truncate rounded-md border-l-2 px-1.5 py-0.5 text-[11px] font-medium", EVENT_STYLE[a.status] ?? EVENT_STYLE.booked)}
                        >
                          {formatTime(a.startAt, tz)} {a.title}
                        </Link>
                      </li>
                    ))}
                    {items.length > 3 ? <li className="px-1.5 text-[11px] text-slate-500">+{items.length - 3} more</li> : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <Card title="Book an appointment" icon={CalendarPlus}>
          {contacts.length ? (
            <ActionForm action={bookAppointmentAction} resetOnSuccess className="space-y-3" aria-label="Book appointment">
              <Field label="Contact" htmlFor="appt-contact">
                <Select id="appt-contact" name="contactId" required>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {contactName(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title" htmlFor="appt-title">
                <Input id="appt-title" name="title" required defaultValue="Discovery call" />
              </Field>
              <Field label={`Start (${tz})`} htmlFor="appt-start">
                <Input id="appt-start" name="startAt" type="datetime-local" required defaultValue={defaultStart} />
              </Field>
              <Field label="Duration" htmlFor="appt-duration">
                <Select id="appt-duration" name="duration" defaultValue="30">
                  {[15, 30, 45, 60, 90].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </Select>
              </Field>
              <SubmitButton className="w-full">Book appointment</SubmitButton>
            </ActionForm>
          ) : (
            <EmptyState title="Add a contact first" icon={CalendarDays} />
          )}
        </Card>
      </div>

      <Card title="Agenda" description={monthLabel} icon={ListChecks} className="mt-6">
        {appointments.length ? (
          <ul className="divide-y divide-line">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={contactName(a.contact)} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      {a.title}
                      <Badge tone={statusTone(a.status)} dot>
                        {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                      </Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      <Link href={`/contacts/${a.contact.id}`} className="hover:underline">
                        {contactName(a.contact)}
                      </Link>{" "}
                      · {formatDateTime(a.startAt, tz)} – {formatTime(a.endAt, tz)}
                    </p>
                  </div>
                </div>
                <ActionForm action={setAppointmentStatusAction.bind(null, a.id)} className="flex items-center gap-2">
                  <Select name="status" defaultValue={a.status} className="w-32 py-1.5 text-xs" aria-label={`Status for ${a.title}`}>
                    {APPOINTMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {APPOINTMENT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton size="sm" variant="secondary">
                    Update
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No appointments this month" icon={CalendarDays} />
        )}
      </Card>
    </>
  );
}
