import Link from "next/link";
import { Card, contactName, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { getDashboard } from "@/modules/dashboard/service";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { db, subAccount } = await requireTenant();
  const tz = subAccount.timezone;
  const d = await getDashboard(db);

  return (
    <>
      <PageHeader title="Dashboard" description={`${subAccount.name} · times shown in ${tz}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Contacts" value={d.contactCount} />
        <Stat label="Open opportunities" value={d.openOpportunityCount} hint={`${formatCents(d.openOpportunityValue)} in pipeline`} />
        <Stat label="Upcoming appointments" value={d.upcoming.length} hint="next 5 booked" />
        <Stat label="Open tasks" value={d.openTasks} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Campaigns & automation" className="lg:col-span-1">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Active campaigns" value={d.campaigns.active} />
            <Metric label="Contacts in sequence" value={d.campaigns.enrolledActive} />
            <Metric label="Sequences completed" value={d.campaigns.completed} />
            <Metric label="Active workflows" value={d.activeWorkflows} />
            <Metric label="Emails (30d)" value={d.campaigns.emails30d} />
            <Metric label="SMS (30d)" value={d.campaigns.sms30d} />
            <Metric label="Runs in progress" value={d.activeRuns} />
            <Metric label="Collected (simulated)" value={formatCents(d.collected)} />
          </dl>
        </Card>

        <Card title="Upcoming appointments" actions={<Link className="text-xs text-indigo-600" href="/calendar">Calendar</Link>}>
          {d.upcoming.length ? (
            <ul className="divide-y divide-slate-100">
              {d.upcoming.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <p className="font-medium text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    <Link className="hover:underline" href={`/contacts/${a.contact.id}`}>
                      {contactName(a.contact)}
                    </Link>{" "}
                    · {formatDateTime(a.startAt, tz)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing booked" />
          )}
        </Card>

        <Card title="Recent activity">
          {d.activity.length ? (
            <ul className="space-y-2">
              {d.activity.map((a) => (
                <li key={a.id} className="text-sm">
                  <Link href={`/contacts/${a.contact.id}`} className="font-medium text-slate-800 hover:underline">
                    {contactName(a.contact)}
                  </Link>
                  <span className="text-slate-600">: {a.title}</span>
                  <p className="text-xs text-slate-400">{formatDateTime(a.createdAt, tz)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" />
          )}
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
