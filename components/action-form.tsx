"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormAction } from "@/lib/action-state";
import { Button, cx, type ButtonVariant } from "./ui";

/**
 * A form bound to a server action that returns ActionState. Shows the error
 * or success message inline; optionally clears its fields on success.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  ...rest
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  "aria-label"?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      aria-label={rest["aria-label"]}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      {state?.error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? <p className="mt-2 text-sm text-emerald-700">{state.message}</p> : null}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingText,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={cx(className)}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
