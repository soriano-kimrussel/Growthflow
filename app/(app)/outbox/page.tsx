import Link from "next/link";
import { RunnerControls } from "@/components/runner-controls";
import { Badge, Card, contactName, cx, EmptyState, PageHeader } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { formatDateTime } from "@/lib/time";
import { listOutbox } from "@/modules/messaging/service";

export const metadata = { title: "Outbox" };

export default async function OutboxPage({ searchParams }: PageProps<"/outbox">) {
  const { channel: raw } = await searchParams;
  const channel = raw === "email" || raw === "sms" ? raw : undefined;
  const { db, subAccount } = await requireTenant();
  const messages = await listOutbox(db, { channel });
  const tabs = [
    { label: "All", href: "/outbox", active: !channel },
    { label: "Email", href: "/outbox?channel=email", active: channel === "email" },
    { label: "SMS", href: "/outbox?channel=sms", active: channel === "sms" },
  ];

  return (
    <>
      <PageHeader
        title="Outbox"
        description={`Every message the simulated provider "sent" (provider: ${process.env.MESSAGING_PROVIDER ?? "simulated"}). Nothing leaves this machine.`}
        actions={<RunnerControls />}
      />
      <nav className="mb-4 flex gap-2" aria-label="Channel">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cx("rounded-full px-3 py-1 text-sm", t.active ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Card>
        {messages.length ? (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={m.channel === "email" ? "indigo" : "blue"}>{m.channel.toUpperCase()}</Badge>
                  <span className="font-medium text-slate-800">{m.to}</span>
                  {m.contact ? (
                    <Link href={`/contacts/${m.contact.id}`} className="text-xs text-slate-500 hover:underline">
                      ({contactName(m.contact)})
                    </Link>
                  ) : null}
                  <Badge>{m.source}</Badge>
                  <span className="ml-auto text-xs text-slate-400">{formatDateTime(m.createdAt, subAccount.timezone)}</span>
                </div>
                {m.subject ? <p className="mt-1 font-medium text-slate-700">{m.subject}</p> : null}
                <p className="mt-0.5 whitespace-pre-line break-words text-slate-600">{m.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="The outbox is empty">Campaigns, workflows and invitations will drop messages here.</EmptyState>
        )}
      </Card>
    </>
  );
}
