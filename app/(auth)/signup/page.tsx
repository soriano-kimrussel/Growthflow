import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { signupAction } from "@/modules/auth/actions";

export const metadata = { title: "Create an agency" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">Create your agency</h1>
      <p className="mb-4 mt-1 text-sm text-slate-500">You&apos;ll be its Agency Admin. We&apos;ll set up a first sub-account for you.</p>
      <ActionForm action={signupAction} className="space-y-4">
        <Field label="Agency name" htmlFor="agencyName">
          <Input id="agencyName" name="agencyName" required />
        </Field>
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton className="w-full" pendingText="Creating...">
          Create agency
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600">
          Sign in
        </Link>
      </p>
    </>
  );
}
