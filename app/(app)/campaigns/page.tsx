import Link from "next/link";
import { ChevronRight, Megaphone, Plus } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { Badge, Card, EmptyState, Input, PageHeader, Progress, statusTone } from "@/components/ui";
import { ActionGlyph } from "@/components/workflow-icons";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createCampaignAction } from "@/modules/campaigns/actions";

export const metadata = { title: "Campaigns" };

const STEP_GLYPH: Record<string, string> = { email: "send_email", sms: "send_sms", wait: "wait" };

export default async function CampaignsPage() {
  const { db, role } = await requireTenant();
  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: "asc" },
    include: { steps: { orderBy: { position: "asc" }, select: { id: true, type: true } } },
  });
  const enrollments = await db.campaignEnrollment.groupBy({ by: ["campaignId", "status"], _count: { _all: true } });
  const stats = (id: string, status: string) => enrollments.find((e) => e.campaignId === id && e.status === status)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="Campaigns" description="Ordered sequences of emails, SMS and waits." actions={<RunnerControls />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          {campaigns.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {campaigns.map((c) => {
                const active = stats(c.id, "active");
                const completed = stats(c.id, "completed");
                const total = active + completed + stats(c.id, "stopped");
                return (
                  <li key={c.id}>
                    <Link href={`/campaigns/${c.id}`} className="group block h-full rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-pop">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-white shadow-sm">
                          <Megaphone className="h-5 w-5" />
                        </span>
                        <Badge tone={statusTone(c.status)} dot>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="mt-3 font-semibold text-slate-900 group-hover:text-brand-700">{c.name}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1">
                        {c.steps.map((s, i) => (
                          <span key={s.id} className="flex items-center gap-1">
                            {i > 0 ? <ChevronRight aria-hidden className="h-3 w-3 text-slate-300" /> : null}
                            <ActionGlyph type={STEP_GLYPH[s.type] ?? "wait"} size="sm" />
                          </span>
                        ))}
                        {!c.steps.length ? <span className="text-xs text-slate-400">No steps yet</span> : null}
                      </div>
                      <div className="mt-4 border-t border-line pt-3">
                        <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                          <span>
                            <span className="font-semibold text-slate-900">{total}</span> enrolled · {active} in sequence
                          </span>
                          <span>{completed} completed</span>
                        </div>
                        <Progress value={total ? (completed / total) * 100 : 0} tone="bg-emerald-500" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No campaigns yet" icon={Megaphone} />
          )}
        </div>
        {can(role, "campaigns:manage") ? (
          <Card title="New campaign" description="Add steps after creating it" icon={Plus}>
            <ActionForm action={createCampaignAction} className="space-y-3" aria-label="New campaign">
              <Input name="name" required placeholder="Spring promo" aria-label="Campaign name" />
              <SubmitButton className="w-full">Create campaign</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
