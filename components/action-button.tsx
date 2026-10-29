"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { Button, type ButtonVariant } from "./ui";

/** A button that calls a (bound) server action and shows any error inline. */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  title,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  confirm?: string;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState>(undefined);
  return (
    <span className="inline-flex flex-col items-start">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        title={title}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => setResult(await action()));
        }}
      >
        {children}
      </Button>
      {result?.error ? (
        <span role="alert" className="mt-1 text-xs text-red-600">
          {result.error}
        </span>
      ) : null}
      {result?.ok && result.message ? <span className="mt-1 text-xs text-emerald-700">{result.message}</span> : null}
    </span>
  );
}
