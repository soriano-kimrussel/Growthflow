import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/auth/permissions";
import { TenantScopeError } from "@/lib/db/tenant";
import type { ActionState } from "./action-state";

export function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Invalid input";
  if (error instanceof ForbiddenError) return error.message;
  // Never reveal whether a row exists in someone else's sub-account.
  if (error instanceof TenantScopeError) return "Not found";
  if (error instanceof Error && error.name === "PrismaClientKnownRequestError") return "Not found or already changed";
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

/**
 * Runs a mutation and turns failures into a form-friendly state. Next.js
 * control-flow errors (redirect, notFound) pass straight through.
 */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}

export function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
