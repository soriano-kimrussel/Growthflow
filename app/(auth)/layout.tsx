import Link from "next/link";
import { Building2, CheckCircle2, KanbanSquare, Workflow, Zap } from "lucide-react";

const FEATURES = [
  { icon: Building2, text: "Isolated client workspaces under one agency" },
  { icon: KanbanSquare, text: "Contacts, pipelines and calendars per client" },
  { icon: Workflow, text: "Campaigns and a database-backed workflow engine" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Zap className="h-4 w-4" fill="currentColor" />
          </span>
          <span className="text-lg font-semibold">GrowthFlow</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Run every client&apos;s growth from one agency dashboard.</h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-10 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Local-first and free
            </p>
            <p className="mt-1 text-xs text-white/75">Email, SMS and payments are simulated behind adapters. Nothing leaves your machine.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
              <Zap className="h-4 w-4" fill="currentColor" />
            </span>
            <span className="text-lg font-semibold text-slate-900">GrowthFlow</span>
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}
