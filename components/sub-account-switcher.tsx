"use client";

import { switchSubAccountAction } from "@/modules/auth/actions";
import { cx } from "./ui";

/**
 * Asks the server to switch the session's sub-account. The server checks that
 * the user may access the chosen one; the id is never trusted for queries.
 */
export function SubAccountSwitcher({
  current,
  options,
  compact = false,
}: {
  current: string;
  options: { id: string; name: string }[];
  compact?: boolean;
}) {
  return (
    <form action={switchSubAccountAction}>
      <label className={compact ? "sr-only" : "mb-1 block px-2 text-xs uppercase tracking-wide text-slate-400"} htmlFor={`sa-${compact}`}>
        Sub-account
      </label>
      <select
        id={`sa-${compact}`}
        name="subAccountId"
        defaultValue={current}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={cx(
          "w-full rounded-md px-2 py-1.5 text-sm",
          compact ? "border border-slate-300 bg-white text-slate-800" : "border border-slate-700 bg-slate-800 text-white",
        )}
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
