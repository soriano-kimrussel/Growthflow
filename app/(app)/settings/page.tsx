import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { requirePermission } from "@/lib/auth/context";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/time";
import { inviteMemberAction, removeMemberAction, updateMemberRoleAction } from "@/modules/agency/actions";
import { listMembers, listPendingInvitations } from "@/modules/agency/service";

export const metadata = { title: "Team" };

export default async function SettingsPage() {
  const ctx = await requirePermission("team:manage");
  const [members, invitations] = await Promise.all([listMembers(ctx.subAccount.id), listPendingInvitations(ctx.subAccount.id)]);
  return (
    <>
      <PageHeader title="Team" description={`People with access to ${ctx.subAccount.name}. Agency admins can access every sub-account.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Members" className="lg:col-span-2">
          {members.length ? (
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{m.user.name}</p>
                    <p className="text-xs text-slate-500">{m.user.email}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ActionForm action={updateMemberRoleAction.bind(null, m.id)} className="flex gap-2">
                      <Select name="role" defaultValue={m.role} className="w-44 py-1 text-xs" aria-label={`Role for ${m.user.name}`}>
                        <option value="admin">{ROLE_LABELS.admin}</option>
                        <option value="user">{ROLE_LABELS.user}</option>
                      </Select>
                      <SubmitButton size="sm" variant="secondary">
                        Save
                      </SubmitButton>
                    </ActionForm>
                    {m.user.id !== ctx.user.id ? (
                      <ActionButton action={removeMemberAction.bind(null, m.id)} variant="danger" confirm={`Remove ${m.user.name}?`}>
                        Remove
                      </ActionButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No members yet" />
          )}
          {invitations.length ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pending invitations</h3>
              <ul className="space-y-1 text-sm">
                {invitations.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>
                      {i.email} · {ROLE_LABELS[i.role === "admin" ? "admin" : "user"]}
                    </span>
                    <span className="text-xs text-slate-500">expires {formatDate(i.expiresAt, ctx.subAccount.timezone)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
        <Card title="Invite someone">
          <ActionForm action={inviteMemberAction} resetOnSuccess className="space-y-3" aria-label="Invite member">
            <Field label="Email" htmlFor="invite-email">
              <Input id="invite-email" name="email" type="email" required />
            </Field>
            <Field label="Role" htmlFor="invite-role">
              <Select id="invite-role" name="role" defaultValue="user">
                <option value="user">{ROLE_LABELS.user}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </Select>
            </Field>
            <SubmitButton>Send invitation</SubmitButton>
          </ActionForm>
          <p className="mt-3 text-xs text-slate-500">The invitation email is simulated: it lands in the Outbox, and the link is shown here.</p>
        </Card>
      </div>
    </>
  );
}
