import { redirect } from "next/navigation";
import { Building2, KanbanSquare, LayoutTemplate, Megaphone, Users, Workflow, Zap } from "lucide-react";
import { ButtonLink, IconTile, type TileTone } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/context";

const FEATURES: { icon: typeof Users; tone: TileTone; title: string; text: string }[] = [
  { icon: Building2, tone: "brand", title: "Agency & sub-accounts", text: "Every client gets an isolated workspace, enforced in the data layer." },
  { icon: Users, tone: "sky", title: "Contacts & timelines", text: "Tags, custom fields, notes and a full activity history per contact." },
  { icon: KanbanSquare, tone: "violet", title: "Pipelines", text: "Drag-and-drop Kanban boards with stage totals." },
  { icon: Megaphone, tone: "rose", title: "Campaigns", text: "Email, SMS and wait steps with merge fields." },
  { icon: Workflow, tone: "amber", title: "Workflow engine", text: "Trigger → action automations, persisted and resumable." },
  { icon: LayoutTemplate, tone: "green", title: "Snapshots", text: "Clone a proven setup into a new client in one click." },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <Zap className="h-4 w-4" fill="currentColor" />
          </span>
          <span className="font-semibold text-slate-900">GrowthFlow</span>
        </span>
        <ButtonLink href="/login" variant="secondary">
          Sign in
        </ButtonLink>
      </header>
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-16 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
          <Zap className="h-3 w-3" /> Local-first · $0 to run
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">CRM and marketing automation for agencies</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Contacts, pipelines, calendars, campaigns and a database-backed workflow engine, with isolated sub-accounts for every client.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/signup">Create an agency</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Try the demo
          </ButtonLink>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Demo login: <code>admin@growthflow.dev</code> / <code>password123</code>
        </p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <IconTile icon={f.icon} tone={f.tone} />
            <p className="mt-3 font-semibold text-slate-900">{f.title}</p>
            <p className="mt-1 text-sm text-slate-500">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
