import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { CampaignStepFields } from "@/components/step-fields";
import { Badge, Card, contactName, EmptyState, Field, PageHeader, Select, statusTone } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/time";
import {
  addCampaignStepAction,
  deleteCampaignAction,
  deleteCampaignStepAction,
  enrollAction,
  moveCampaignStepAction,
  setCampaignStatusAction,
  stopEnrollmentAction,
} from "@/modules/campaigns/actions";
import { getCampaign } from "@/modules/campaigns/service";
import { contactOptions } from "@/modules/contacts/service";
import { listTags } from "@/modules/tags/service";

export const metadata = { title: "Campaign" };

function describeStep(step: { type: string; subject: string | null; body: string | null; waitAmount: number | null; waitUnit: string | null }) {
  if (step.type === "wait") return `Wait ${step.waitAmount} ${step.waitUnit}`;
  if (step.type === "email") return `Email: ${step.subject}`;
  return `SMS: ${step.body}`;
}

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const { db, role, subAccount } = await requireTenant();
  const campaign = await getCampaign(db, id);
  if (!campaign) notFound();
  const [tags, contacts] = await Promise.all([listTags(db), contactOptions(db)]);
  const canManage = can(role, "campaigns:manage");
  const enrolled = new Set(campaign.enrollments.map((e) => e.contactId));

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={
          <span className="inline-flex items-center gap-2">
            <Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge>
            {campaign.status === "draft" ? "Enrolled contacts start receiving steps once the campaign is active." : null}
          </span>
        }
        actions={
          <>
            {canManage && campaign.status !== "active" ? (
              <ActionButton action={setCampaignStatusAction.bind(null, campaign.id, "active")} variant="primary" size="md">
                Activate
              </ActionButton>
            ) : null}
            {canManage && campaign.status === "active" ? (
              <ActionButton action={setCampaignStatusAction.bind(null, campaign.id, "paused")} size="md">
                Pause
              </ActionButton>
            ) : null}
            {canManage ? (
              <ActionButton action={deleteCampaignAction.bind(null, campaign.id)} variant="danger" size="md" confirm="Delete this campaign?">
                Delete
              </ActionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Steps">
          {campaign.steps.length ? (
            <ol className="space-y-2">
              {campaign.steps.map((s, i) => (
                <li key={s.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      {i + 1}. {describeStep(s)}
                    </p>
                    {s.type === "email" ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.body}</p> : null}
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      <ActionButton action={moveCampaignStepAction.bind(null, campaign.id, s.id, "up")} variant="ghost" title="Move up">
                        ↑
                      </ActionButton>
                      <ActionButton action={moveCampaignStepAction.bind(null, campaign.id, s.id, "down")} variant="ghost" title="Move down">
                        ↓
                      </ActionButton>
                      <ActionButton action={deleteCampaignStepAction.bind(null, campaign.id, s.id)} variant="ghost" title="Delete step">
                        ✕
                      </ActionButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No steps yet" />
          )}
          {canManage ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ActionForm action={addCampaignStepAction.bind(null, campaign.id)} resetOnSuccess className="space-y-3" aria-label="Add step">
                <CampaignStepFields />
                <SubmitButton variant="secondary">Add step</SubmitButton>
              </ActionForm>
            </div>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card title="Enroll contacts">
            <ActionForm action={enrollAction.bind(null, campaign.id)} className="space-y-3" aria-label="Enroll contacts">
              <Field label="Everyone with tag" htmlFor="enroll-tag">
                <Select id="enroll-tag" name="tag" defaultValue="">
                  <option value="">(none)</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t._count.contacts})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="And/or these contacts" htmlFor="enroll-contacts" hint="Ctrl/Cmd-click to pick several">
                <Select id="enroll-contacts" name="contactIds" multiple size={6}>
                  {contacts
                    .filter((c) => !enrolled.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {contactName(c)}
                      </option>
                    ))}
                </Select>
              </Field>
              <SubmitButton>Enroll</SubmitButton>
            </ActionForm>
          </Card>

          <Card title={`Enrollments (${campaign.enrollments.length})`} actions={<RunnerControls />}>
            {campaign.enrollments.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {campaign.enrollments.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/contacts/${e.contact.id}`} className="hover:underline">
                      {contactName(e.contact)}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      step {Math.min(e.currentStep + 1, campaign.steps.length)}/{campaign.steps.length}
                      {e.status === "active" && e.nextRunAt ? ` · next ${formatDateTime(e.nextRunAt, subAccount.timezone)}` : ""}
                      <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                      {e.status === "active" ? (
                        <ActionButton action={stopEnrollmentAction.bind(null, campaign.id, e.id)} variant="ghost">
                          Stop
                        </ActionButton>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nobody enrolled yet" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
