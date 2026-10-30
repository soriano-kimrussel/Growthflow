"use client";

import { ChevronsUpDown } from "lucide-react";
import { switchSubAccountAction } from "@/modules/auth/actions";
import { initials, swatch, cx } from "./ui";

/**
 * Workspace switcher card. Choosing an option asks the server to switch the
 * session's sub-account; the server checks access, and the id is never trusted
 * for queries.
 */
export function SubAccountSwitcher({
  current,
  options,
  agencyName,
  compact = false,
}: {
  current: string;
  options: { id: string; name: string }[];
  agencyName?: string;
  compact?: boolean;
}) {
  const active = options.find((o) => o.id === current);
  const id = `sa-${compact ? "compact" : "full"}`;
  return (
    <form action={switchSubAccountAction} className="relative">
      <label htmlFor={id} className="sr-only">
        Sub-account
      </label>
      <div
        className={cx(
          "flex items-center gap-2.5 rounded-xl border border-line bg-white shadow-card transition-colors hover:border-slate-300",
          compact ? "px-2 py-1" : "px-2.5 py-2",
        )}
      >
        <span className={cx("flex shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-inset", swatch(active?.name ?? ""), compact ? "h-6 w-6" : "h-8 w-8")}>
          {initials(active?.name ?? "?")}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-slate-900">{active?.name}</span>
          {!compact ? <span className="block truncate text-[11px] text-slate-500">{agencyName ?? "Sub-account"}</span> : null}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      {/* The real control: an invisible native select covering the card. */}
      <select
        id={id}
        name="subAccountId"
        defaultValue={current}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
