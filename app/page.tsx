import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/context";

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">GrowthFlow</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">CRM and marketing automation for agencies</h1>
      <p className="mt-4 max-w-xl text-slate-600">
        Contacts, pipelines, calendars, campaigns and a database-backed workflow engine, with isolated sub-accounts for
        every client. Messaging and payments are simulated, so nothing leaves your machine.
      </p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/signup">Create an agency</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          Sign in
        </ButtonLink>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Seeded demo login: <code>admin@growthflow.dev</code> / <code>password123</code>
      </p>
    </main>
  );
}
