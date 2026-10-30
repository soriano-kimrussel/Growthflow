import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { loginAction } from "@/modules/auth/actions";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to your agency workspace.</p>
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
      <div className="mt-6 rounded-xl border border-dashed border-line bg-slate-50 p-3 text-xs text-slate-500">
        Demo: <code className="font-medium text-slate-700">admin@growthflow.dev</code> / <code className="font-medium text-slate-700">password123</code>
      </div>
      <p className="mt-4 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-brand-600">
          Create an agency
        </Link>
      </p>
    </>
  );
}
