"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CheckSquare,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  UserCog,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const WORKSPACE: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/opportunities", label: "Opportunities", icon: KanbanSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

const MARKETING: NavLink[] = [
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/outbox", label: "Outbox", icon: Inbox },
];

export function Nav({
  hasSubAccount,
  canManageTeam,
  isAgencyAdmin,
  horizontal = false,
}: {
  hasSubAccount: boolean;
  canManageTeam: boolean;
  isAgencyAdmin: boolean;
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const admin: NavLink[] = [
    ...(hasSubAccount && canManageTeam ? [{ href: "/settings", label: "Team", icon: UserCog }] : []),
    ...(isAgencyAdmin ? [{ href: "/agency", label: "Agency", icon: Building2 }] : []),
  ];
  const groups = [
    { title: "Workspace", links: hasSubAccount ? WORKSPACE : [] },
    { title: "Marketing", links: hasSubAccount ? MARKETING : [] },
    { title: "Admin", links: admin },
  ].filter((g) => g.links.length);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (horizontal) {
    return (
      <nav aria-label="Main" className="scroll-thin flex gap-1 overflow-x-auto px-3 py-2">
        {groups.flatMap((g) => g.links).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
              isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
          <ul className="space-y-0.5">
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <Icon className={cx("h-[18px] w-[18px]", active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600")} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
