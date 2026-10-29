import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, buttonClass, Card, contactName, cx, EmptyState, Field, Input, PageHeader, Select, statusTone } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/domain";
import { formatDateTime, formatTime, toWallTime, zonedDateKey, zonedWallTimeToUtc } from "@/lib/time";
import { bookAppointmentAction, setAppointmentStatusAction } from "@/modules/appointments/actions";
import { listAppointments } from "@/modules/appointments/service";
import { contactOptions } from "@/modules/contacts/service";

export const metadata = { title: "Calendar" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

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
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  const defaultStart = toWallTime(new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000 + 86_400_000), tz);

  return (
    <>
      <PageHeader title="Calendar" description={`Times in ${tz}`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={monthLabel}
          actions={
            <div className="flex gap-1">
              <Link className={buttonClass("secondary", "sm")} href={`/calendar?month=${prev.y}-${pad(prev.m)}`}>
                ‹ Prev
              </Link>
              <Link className={buttonClass("secondary", "sm")} href="/calendar">
                Today
              </Link>
              <Link className={buttonClass("secondary", "sm")} href={`/calendar?month=${next.y}-${pad(next.m)}`}>
                Next ›
              </Link>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-slate-50 px-2 py-1 font-medium text-slate-500">
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              const key = day ? `${year}-${pad(month)}-${pad(day)}` : `empty-${i}`;
              const items = day ? (byDay.get(key) ?? []) : [];
              return (
                <div key={key} className={cx("min-h-20 bg-white p-1", !day && "bg-slate-50")}>
                  {day ? (
                    <span className={cx("inline-block rounded px-1", key === today && "bg-indigo-600 text-white")}>{day}</span>
                  ) : null}
                  <ul className="mt-1 space-y-0.5">
                    {items.map((a) => (
                      <li key={a.id} className={cx("truncate rounded px-1", a.status === "cancelled" ? "bg-slate-100 text-slate-400 line-through" : "bg-indigo-50 text-indigo-800")}>
                        {formatTime(a.startAt, tz)} {a.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Book an appointment">
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
              <SubmitButton>Book</SubmitButton>
            </ActionForm>
          ) : (
            <EmptyState title="Add a contact first" />
          )}
        </Card>
      </div>

      <Card title={`Appointments in ${monthLabel}`} className="mt-6">
        {appointments.length ? (
          <ul className="divide-y divide-slate-100">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {a.title}{" "}
                    <Badge tone={statusTone(a.status)}>{APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">
                    <Link href={`/contacts/${a.contact.id}`} className="hover:underline">
                      {contactName(a.contact)}
                    </Link>{" "}
                    · {formatDateTime(a.startAt, tz)} – {formatTime(a.endAt, tz)}
                  </p>
                </div>
                <ActionForm action={setAppointmentStatusAction.bind(null, a.id)} className="flex items-center gap-2">
                  <Select name="status" defaultValue={a.status} className="w-32 py-1 text-xs" aria-label={`Status for ${a.title}`}>
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
          <EmptyState title="No appointments this month" />
        )}
      </Card>
    </>
  );
}
