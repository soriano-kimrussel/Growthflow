import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, CircleStop, Megaphone, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RunnerControls } from "@/components/runner-controls";
import { CampaignStepFields } from "@/components/step-fields";
import { Avatar, Badge, Card, contactName, EmptyState, Field, Select, statusTone } from "@/components/ui";
import { ActionGlyph } from "@/components/workflow-icons";
import { requireTenant } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatWait } from "@/lib/domain";
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

const STEP_GLYPH: Record<string, string> = { email: "send_email", sms: "send_sms", wait: "wait" };
const STEP_LABEL: Record<string, string> = { email: "Email", sms: "SMS", wait: "Wait" };

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const { db, role, subAccount } = await requireTenant();
  const campaign = await getCampaign(db, id);
  if (!campaign) notFound();
  const [tags, contacts] = await Promise.all([listTags(db), contactOptions(db)]);
  const canManage = can(role, "campaigns:manage");
  const enrolled = new Set(campaign.enrollments.map((e) => e.contactId));
  const stepCount = campaign.steps.length;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/campaigns" className="hover:text-slate-900">
          Campaigns
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-900">{campaign.name}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{campaign.name}</h1>
            <Badge tone={statusTone(campaign.status)} dot>
              {campaign.status}
            </Badge>
          </div>
          {campaign.status === "draft" ? <p className="mt-1 text-sm text-slate-500">Enrolled contacts start receiving steps once the campaign is active.</p> : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
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
            <ActionButton action={deleteCampaignAction.bind(null, campaign.id)} variant="danger" size="md" confirm="Delete this campaign?" title="Delete campaign">
              <Trash2 className="h-4 w-4" />
            </ActionButton>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section aria-label="Campaign sequence" className="canvas-dots rounded-2xl border border-line px-4 py-8">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <Megaphone className="h-3.5 w-3.5" /> Contact enrolled
            </span>
            {campaign.steps.map((s, i) => {
              const isWait = s.type === "wait";
              const here = campaign.enrollments.filter((e) => e.status === "active" && e.currentStep === i).length;
              return (
                <div key={s.id} className="flex w-full flex-col items-center">
                  <span aria-hidden className="h-8 w-px bg-slate-300" />
                  <div
                    className={
                      isWait
                        ? "flex w-full max-w-xs items-center gap-3 rounded-full border border-dashed border-slate-300 bg-white/90 py-2 pl-2 pr-2 shadow-card"
                        : "w-full rounded-2xl border border-line bg-white p-3.5 shadow-card"
                    }
                  >
                    <div className="flex items-center gap-3">
                      <ActionGlyph type={STEP_GLYPH[s.type] ?? "wait"} size={isWait ? "sm" : "md"} />
                      <div className="min-w-0 flex-1">
                        {isWait ? (
                          <p className="text-sm font-medium text-slate-700">Wait {formatWait(s.waitAmount ?? 1, s.waitUnit ?? "days")}</p>
                        ) : (
                          <>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Step {i + 1} · {STEP_LABEL[s.type]}
                            </p>
                            <p className="truncate text-sm font-semibold text-slate-900">{s.type === "email" ? s.subject : s.body}</p>
                          </>
                        )}
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0">
                          <ActionButton action={moveCampaignStepAction.bind(null, campaign.id, s.id, "up")} variant="ghost" title="Move up">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </ActionButton>
                          <ActionButton action={moveCampaignStepAction.bind(null, campaign.id, s.id, "down")} variant="ghost" title="Move down">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </ActionButton>
                          <ActionButton action={deleteCampaignStepAction.bind(null, campaign.id, s.id)} variant="ghost" title="Delete step">
                            <Trash2 className="h-3.5 w-3.5" />
                          </ActionButton>
                        </div>
                      ) : null}
                    </div>
                    {s.type === "email" ? <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                        <p className="line-clamp-2">{s.body}</p>
                      </div> : null}
                  </div>
                  {here ? (
                    <span className="mt-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      {here} contact{here === 1 ? "" : "s"} up next here
                    </span>
                  ) : null}
                </div>
              );
            })}
            <span aria-hidden className="h-8 w-px bg-slate-300" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
              <CircleStop className="h-3.5 w-3.5" /> End of sequence
            </span>
            {!stepCount ? <p className="mt-4 text-sm text-slate-500">Add the first step from the panel.</p> : null}
          </div>
        </section>

        <aside className="space-y-6">
          {canManage ? (
            <Card title="Add step" icon={Plus}>
              <ActionForm action={addCampaignStepAction.bind(null, campaign.id)} resetOnSuccess className="space-y-3" aria-label="Add step">
                <CampaignStepFields />
                <SubmitButton className="w-full">Add step</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}
          <Card title="Enroll contacts" icon={UserPlus}>
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
              <SubmitButton className="w-full">Enroll</SubmitButton>
            </ActionForm>
          </Card>
        </aside>
      </div>

      <Card title="Enrollments" description={`${campaign.enrollments.length} contact${campaign.enrollments.length === 1 ? "" : "s"}`} icon={Users} actions={<RunnerControls />} className="mt-6">
        {campaign.enrollments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Progress</th>
                  <th className="py-2 pr-4">Next step</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {campaign.enrollments.map((e) => {
                  const done = Math.min(e.currentStep, stepCount);
                  return (
                    <tr key={e.id}>
                      <td className="py-2.5 pr-4">
                        <Link href={`/contacts/${e.contact.id}`} className="flex items-center gap-2 font-medium text-slate-900 hover:text-brand-700">
                          <Avatar name={contactName(e.contact)} size="xs" />
                          {contactName(e.contact)}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={statusTone(e.status)} dot>
                          {e.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex gap-0.5">
                            {campaign.steps.map((s, i) => (
                              <span key={s.id} className={`h-1.5 w-3 rounded-full ${i < done ? "bg-emerald-500" : "bg-slate-200"}`} />
                            ))}
                          </span>
                          {done}/{stepCount}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-slate-500">
                        {e.status === "active" && e.nextRunAt ? formatDateTime(e.nextRunAt, subAccount.timezone) : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        {e.status === "active" ? (
                          <ActionButton action={stopEnrollmentAction.bind(null, campaign.id, e.id)} variant="ghost">
                            Stop
                          </ActionButton>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nobody enrolled yet" icon={Users} />
        )}
      </Card>
    </>
  );
}
