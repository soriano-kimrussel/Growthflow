"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const TENANT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/workflows", label: "Workflows" },
  { href: "/outbox", label: "Outbox" },
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
  const links = [
    ...(hasSubAccount ? TENANT_LINKS : []),
    ...(hasSubAccount && canManageTeam ? [{ href: "/settings", label: "Team" }] : []),
    ...(isAgencyAdmin ? [{ href: "/agency", label: "Agency" }] : []),
  ];
  return (
    <nav aria-label="Main" className={horizontal ? "flex gap-1 overflow-x-auto px-2 py-2" : "flex flex-col gap-0.5 px-3"}>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cx(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
              horizontal
                ? active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100"
                : active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
