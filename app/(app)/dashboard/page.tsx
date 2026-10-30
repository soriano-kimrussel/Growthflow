import Link from "next/link";
import { CalendarDays, DollarSign, ListTodo, Mail, Megaphone, MessageSquare, Target, Users, Workflow, Activity, ArrowUpRight } from "lucide-react";
import { ActivityIcon } from "@/components/activity-icon";
import { Avatar, ButtonLink, Card, contactName, EmptyState, IconTile, PageHeader, StatCard } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { formatCents } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import { getDashboard } from "@/modules/dashboard/service";

export const metadata = { title: "Dashboard" };

function greeting(timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const { db, subAccount, user } = await requireTenant();
  const tz = subAccount.timezone;
  const d = await getDashboard(db);
  const maxStageValue = Math.max(1, ...(d.pipeline?.stages.map((s) => s.value) ?? [0]));
  const monthDay = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).formatToParts(date);
    return { month: parts.find((p) => p.type === "month")?.value, day: parts.find((p) => p.type === "day")?.value };
  };

  return (
    <>
      <PageHeader
        eyebrow={subAccount.name}
        title="Dashboard"
        description={`${greeting(tz)}, ${user.name.split(" ")[0]}. Here's what's happening today.`}
        actions={
          <>
            <ButtonLink href="/opportunities" variant="secondary">
              <Target className="h-4 w-4" /> Pipeline
            </ButtonLink>
            <ButtonLink href="/calendar">
              <CalendarDays className="h-4 w-4" /> Book appointment
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Pipeline value" value={formatCents(d.openOpportunityValue)} hint={`${d.openOpportunityCount} open opportunities`} icon={DollarSign} tone="brand" />
        <StatCard label="Contacts" value={d.contactCount.toLocaleString("en-US")} hint={`${d.openTasks} open task${d.openTasks === 1 ? "" : "s"}`} icon={Users} tone="sky" />
        <StatCard label="Won deals" value={formatCents(d.wonValue)} hint={`${d.wonCount} closed won · ${formatCents(d.collected)} collected`} icon={Target} tone="green" />
        <StatCard label="Upcoming appointments" value={d.upcoming.length} hint="next 5 booked" icon={CalendarDays} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Pipeline by stage"
          description={d.pipeline ? `${d.pipeline.name} · open deal value per stage` : undefined}
          actions={
            <Link href="/opportunities" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              Open board <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {d.pipeline && d.pipeline.stages.length ? (
            <ul className="space-y-3.5" aria-label="Open deal value by stage">
              {d.pipeline.stages.map((s) => (
                <li key={s.id} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_7rem]">
                  <span className="truncate text-slate-600">{s.name}</span>
                  <span className="group relative h-5" title={`${s.name}: ${formatCents(s.value)} across ${s.count} deal${s.count === 1 ? "" : "s"}`}>
                    <span className="absolute inset-y-1.5 left-0 right-0 rounded bg-slate-100" />
                    <span
                      className="absolute inset-y-0 left-0 rounded-r rounded-l-sm bg-brand-500 transition-colors group-hover:bg-brand-600"
                      style={{ width: `${s.value ? Math.max(2, (s.value / maxStageValue) * 100) : 0}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="font-semibold text-slate-900">{formatCents(s.value)}</span>
                    <span className="ml-1 text-xs text-slate-400">· {s.count}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No pipeline yet" icon={Target} />
          )}
        </Card>

        <Card title="Marketing" description="Campaigns and automations" icon={Megaphone}>
          <ul className="space-y-3">
            {[
              { icon: Megaphone, tone: "violet" as const, label: "Active campaigns", value: d.campaigns.active, sub: `${d.campaigns.enrolledActive} in sequence · ${d.campaigns.completed} completed` },
              { icon: Workflow, tone: "brand" as const, label: "Active workflows", value: d.activeWorkflows, sub: `${d.activeRuns} run${d.activeRuns === 1 ? "" : "s"} in progress` },
              { icon: Mail, tone: "sky" as const, label: "Emails sent", value: d.campaigns.emails30d, sub: "last 30 days" },
              { icon: MessageSquare, tone: "green" as const, label: "SMS sent", value: d.campaigns.sms30d, sub: "last 30 days" },
              { icon: ListTodo, tone: "amber" as const, label: "Open tasks", value: d.openTasks, sub: "across all contacts" },
            ].map((m) => (
              <li key={m.label} className="flex items-center gap-3">
                <IconTile icon={m.icon} tone={m.tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{m.label}</p>
                  <p className="truncate text-xs text-slate-500">{m.sub}</p>
                </div>
                <span className="text-lg font-semibold tabular-nums text-slate-900">{m.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          title="Upcoming appointments"
          icon={CalendarDays}
          actions={
            <Link href="/calendar" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Calendar
            </Link>
          }
        >
          {d.upcoming.length ? (
            <ul className="space-y-2">
              {d.upcoming.map((a) => {
                const md = monthDay(a.startAt);
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <span className="text-[10px] font-semibold uppercase leading-none">{md.month}</span>
                      <span className="text-base font-bold leading-tight">{md.day}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        <Link className="hover:underline" href={`/contacts/${a.contact.id}`}>
                          {contactName(a.contact)}
                        </Link>{" "}
                        · {formatTime(a.startAt, tz)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Nothing booked" icon={CalendarDays} />
          )}
        </Card>

        <Card title="Recent activity" icon={Activity} className="xl:col-span-2">
          {d.activity.length ? (
            <ul className="divide-y divide-line">
              {d.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <ActivityIcon type={a.type} />
                  <Avatar name={contactName(a.contact)} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <Link href={`/contacts/${a.contact.id}`} className="font-medium text-slate-900 hover:underline">
                      {contactName(a.contact)}
                    </Link>
                    <span className="text-slate-500"> · {a.title}</span>
                  </p>
                  <time className="shrink-0 text-xs text-slate-400">{formatDateTime(a.createdAt, tz)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" icon={Activity} />
          )}
        </Card>
      </div>
    </>
  );
}
