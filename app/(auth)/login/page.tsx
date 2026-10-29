import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { loginAction } from "@/modules/auth/actions";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      <ActionForm action={loginAction} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Signing in...">
          Sign in
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-indigo-600">
          Create an agency
        </Link>
      </p>
    </>
  );
}
