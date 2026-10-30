import Link from "next/link";
import { Inbox, Mail, MessageSquare } from "lucide-react";
import { RunnerControls } from "@/components/runner-controls";
import { Avatar, Badge, contactName, cx, EmptyState, PageHeader, PillTabs } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { formatDateTime } from "@/lib/time";
import { listOutbox } from "@/modules/messaging/service";

export const metadata = { title: "Outbox" };

export default async function OutboxPage({ searchParams }: PageProps<"/outbox">) {
  const { channel: raw } = await searchParams;
  const channel = raw === "email" || raw === "sms" ? raw : undefined;
  const { db, subAccount } = await requireTenant();
  const messages = await listOutbox(db, { channel });

  return (
    <>
      <PageHeader
        title="Outbox"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Every message the provider sent.
            <Badge tone="amber">provider: {process.env.MESSAGING_PROVIDER ?? "simulated"}</Badge>
            Nothing leaves this machine.
          </span>
        }
        actions={<RunnerControls />}
      />
      <div className="mb-4">
        <PillTabs
          label="Channel"
          items={[
            { label: "All", href: "/outbox", active: !channel },
            { label: "Email", href: "/outbox?channel=email", active: channel === "email" },
            { label: "SMS", href: "/outbox?channel=sms", active: channel === "sms" },
          ]}
        />
      </div>
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {messages.length ? (
          <ul className="divide-y divide-line">
            {messages.map((m) => {
              const isEmail = m.channel === "email";
              const Icon = isEmail ? Mail : MessageSquare;
              const who = m.contact ? contactName(m.contact) : m.to;
              return (
                <li key={m.id} className="flex gap-4 px-5 py-4 hover:bg-slate-50/60">
                  <div className="relative shrink-0">
                    <Avatar name={who} />
                    <span
                      className={cx(
                        "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-white",
                        isEmail ? "bg-sky-500" : "bg-emerald-500",
                      )}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {m.contact ? (
                        <Link href={`/contacts/${m.contact.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                          {who}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-900">{who}</span>
                      )}
                      <span className="text-xs text-slate-400">{m.to}</span>
                      <Badge tone={isEmail ? "blue" : "green"}>{m.channel}</Badge>
                      <Badge>{m.source}</Badge>
                      <time className="ml-auto text-xs text-slate-400">{formatDateTime(m.createdAt, subAccount.timezone)}</time>
                    </div>
                    {m.subject ? <p className="mt-1 text-sm font-medium text-slate-800">{m.subject}</p> : null}
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-line break-words text-sm text-slate-500">{m.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6">
            <EmptyState title="The outbox is empty" icon={Inbox}>
              Campaigns, workflows and invitations will drop messages here.
            </EmptyState>
          </div>
        )}
      </section>
    </>
  );
}
