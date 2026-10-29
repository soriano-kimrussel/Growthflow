"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { errorMessage, str } from "@/lib/actions";
import { requireUser, listAccessibleSubAccounts } from "@/lib/auth/context";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { acceptInvitation, findOpenInvitation, signUpAgency } from "@/modules/agency/service";

const signupSchema = z.object({
  agencyName: z.string().trim().min(2, "Agency name is required").max(100),
  name: z.string().trim().min(1, "Your name is required").max(100),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function signupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    agencyName: str(formData, "agencyName"),
    name: str(formData, "name"),
    email: str(formData, "email").trim(),
    password: str(formData, "password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const { user, subAccount } = await signUpAgency(parsed.data);
    await createSession(user.id, subAccount.id);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  redirect("/dashboard");
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email").trim().toLowerCase();
  const password = str(formData, "password");
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  // Same message either way, so the form doesn't reveal which emails exist.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/** Switches the session's active sub-account after checking access. */
export async function switchSubAccountAction(formData: FormData) {
  const current = await requireUser();
  const target = str(formData, "subAccountId");
  const accessible = await listAccessibleSubAccounts(current.user);
  if (!accessible.some((s) => s.id === target)) throw new Error("Not found");
  await prisma.session.update({ where: { id: current.sessionId }, data: { activeSubAccountId: target } });
  redirect("/dashboard");
}

export async function acceptInviteAction(token: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const invitation = await findOpenInvitation(token);
  if (!invitation) return { error: "This invitation is invalid or has expired" };
  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  const password = str(formData, "password");
  try {
    if (existing) {
      if (!(await verifyPassword(password, existing.passwordHash))) return { error: "Incorrect password" };
      await acceptInvitation(token);
    } else {
      const name = str(formData, "name").trim();
      if (!name) return { error: "Your name is required" };
      if (password.length < 8) return { error: "Password must be at least 8 characters" };
      await acceptInvitation(token, { name, password });
    }
  } catch (error) {
    return { error: errorMessage(error) };
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { email: invitation.email } });
  await createSession(user.id, invitation.subAccountId);
  redirect("/dashboard");
}
