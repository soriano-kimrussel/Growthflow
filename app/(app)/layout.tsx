import Link from "next/link";
import { LogOut, Plus, Search, Zap } from "lucide-react";
import { Nav } from "@/components/nav";
import { SubAccountSwitcher } from "@/components/sub-account-switcher";
import { Avatar, buttonClass } from "@/components/ui";
import { getTenantContext, requireUser } from "@/lib/auth/context";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { logoutAction } from "@/modules/auth/actions";

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm shadow-brand-600/30">
        <Zap className="h-4 w-4" fill="currentColor" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">GrowthFlow</span>
    </Link>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const current = await requireUser();
  const ctx = await getTenantContext();
  const role = ctx?.role ?? (current.user.isAgencyAdmin ? "agency_admin" : "user");
  const agency = await prisma.agency.findUnique({ where: { id: current.user.agencyId }, select: { name: true } });
  const switcherOptions = ctx?.accessible.map((s) => ({ id: s.id, name: s.name })) ?? [];
  const navProps = {
    hasSubAccount: Boolean(ctx),
    canManageTeam: ctx ? can(ctx.role, "team:manage") : false,
    isAgencyAdmin: current.user.isAgencyAdmin,
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="px-5 pb-4 pt-5">
          <Logo />
        </div>
        {ctx ? (
          <div className="px-3 pb-5">
            <SubAccountSwitcher current={ctx.subAccount.id} options={switcherOptions} agencyName={agency?.name} />
          </div>
        ) : null}
        <div className="scroll-thin flex-1 overflow-y-auto pb-4">
          <Nav {...navProps} />
        </div>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <Avatar name={current.user.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{current.user.name}</p>
              <p className="truncate text-[11px] text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
            <form action={logoutAction}>
              <button className={buttonClass("ghost", "sm")} aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="md:hidden">
              <Logo />
            </div>
            {ctx ? (
              <form action="/contacts" role="search" className="relative hidden max-w-md flex-1 sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="q"
                  placeholder="Search contacts, emails, companies…"
                  aria-label="Search all contacts"
                  className="h-9 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
              </form>
            ) : (
              <div className="flex-1" />
            )}
            <div className="ml-auto flex items-center gap-3">
              {ctx ? (
                <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 lg:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {ctx.subAccount.timezone}
                </span>
              ) : null}
              {ctx ? (
                <Link href="/contacts/new" className={buttonClass("primary", "md")} aria-label="Add contact">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add contact</span>
                </Link>
              ) : null}
              <span className="md:hidden">
                <Avatar name={current.user.name} size="sm" />
              </span>
            </div>
          </div>
          {ctx ? (
            <div className="border-t border-line px-3 py-2 md:hidden">
              <SubAccountSwitcher current={ctx.subAccount.id} options={switcherOptions} compact />
            </div>
          ) : null}
          <div className="border-t border-line md:hidden">
            <Nav {...navProps} horizontal />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
