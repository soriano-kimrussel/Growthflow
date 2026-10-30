import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { findOpenInvitation } from "@/modules/agency/service";
import { acceptInviteAction } from "@/modules/auth/actions";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invitation = await findOpenInvitation(token);
  if (!invitation) {
    return <p className="text-sm text-slate-600">This invitation is invalid or has expired.</p>;
  }
  const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Join {invitation.subAccount.name}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        {invitation.subAccount.agency.name} invited <strong>{invitation.email}</strong> as{" "}
        {ROLE_LABELS[invitation.role === "admin" ? "admin" : "user"]}.
      </p>
      <ActionForm action={acceptInviteAction.bind(null, token)} className="space-y-4">
        {existing ? null : (
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" required />
          </Field>
        )}
        <Field label={existing ? "Your password" : "Choose a password"} htmlFor="password">
          <Input id="password" name="password" type="password" minLength={existing ? undefined : 8} required />
        </Field>
        <SubmitButton className="w-full">Accept invitation</SubmitButton>
      </ActionForm>
    </>
  );
}
