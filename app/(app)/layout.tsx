import { Nav } from "@/components/nav";
import { SubAccountSwitcher } from "@/components/sub-account-switcher";
import { getTenantContext, requireUser } from "@/lib/auth/context";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { logoutAction } from "@/modules/auth/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const current = await requireUser();
  const ctx = await getTenantContext();
  const role = ctx?.role ?? (current.user.isAgencyAdmin ? "agency_admin" : "user");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 text-slate-200 md:flex">
        <div className="px-5 py-5 text-lg font-semibold text-white">GrowthFlow</div>
        {ctx ? (
          <div className="px-3 pb-4">
            <SubAccountSwitcher current={ctx.subAccount.id} options={ctx.accessible.map((s) => ({ id: s.id, name: s.name }))} />
          </div>
        ) : null}
        <Nav
          hasSubAccount={Boolean(ctx)}
          canManageTeam={ctx ? can(ctx.role, "team:manage") : false}
          isAgencyAdmin={current.user.isAgencyAdmin}
        />
        <div className="mt-auto border-t border-slate-800 px-5 py-4 text-sm">
          <p className="font-medium text-white">{current.user.name}</p>
          <p className="truncate text-xs text-slate-400">{current.user.email}</p>
          <p className="mt-1 text-xs text-slate-400">{ROLE_LABELS[role]}</p>
          <form action={logoutAction} className="mt-3">
            <button className="text-xs text-slate-400 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-semibold text-indigo-600">GrowthFlow</span>
          {ctx ? (
            <SubAccountSwitcher current={ctx.subAccount.id} options={ctx.accessible.map((s) => ({ id: s.id, name: s.name }))} compact />
          ) : null}
        </header>
        <div className="border-b border-slate-200 bg-white md:hidden">
          <Nav
            hasSubAccount={Boolean(ctx)}
            canManageTeam={ctx ? can(ctx.role, "team:manage") : false}
            isAgencyAdmin={current.user.isAgencyAdmin}
            horizontal
          />
        </div>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
