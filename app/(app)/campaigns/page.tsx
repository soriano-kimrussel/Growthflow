import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { Badge, Card, EmptyState, Input, PageHeader, statusTone } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createCampaignAction } from "@/modules/campaigns/actions";
import { listCampaigns } from "@/modules/campaigns/service";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { db, role } = await requireTenant();
  const campaigns = await listCampaigns(db);
  return (
    <>
      <PageHeader title="Campaigns" description="Ordered sequences of emails, SMS and waits." actions={<RunnerControls />} />
      {can(role, "campaigns:manage") ? (
        <Card className="mb-6 max-w-xl">
          <ActionForm action={createCampaignAction} className="flex gap-2" aria-label="New campaign">
            <Input name="name" required placeholder="New campaign name" aria-label="Campaign name" />
            <SubmitButton>Create</SubmitButton>
          </ActionForm>
        </Card>
      ) : null}
      <Card>
        {campaigns.length ? (
          <ul className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/campaigns/${c.id}`} className="font-medium text-indigo-700 hover:underline">
                  {c.name}
                </Link>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  {c._count.steps} steps · {c._count.enrollments} enrolled
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No campaigns yet" />
        )}
      </Card>
    </>
  );
}
