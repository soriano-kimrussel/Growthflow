"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { runAction, str } from "@/lib/actions";
import { requireAgencyAdmin, requirePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { tenantDb } from "@/lib/db/tenant";
import { applySnapshot, captureSnapshot, parseSnapshotData } from "@/modules/snapshots/service";
import { createSubAccount, inviteMember, removeMember, updateMemberRole } from "./service";

export async function createSubAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAgencyAdmin();
    const sub = await createSubAccount(user.agencyId, str(formData, "name"), str(formData, "timezone") || "UTC");
    revalidatePath("/", "layout");
    return `Created "${sub.name}"`;
  });
}

/** Loads a sub-account only if it belongs to the admin's agency. */
async function agencySubAccount(agencyId: string, subAccountId: string) {
  const sub = await prisma.subAccount.findFirst({ where: { id: subAccountId, agencyId } });
  if (!sub) throw new Error("Sub-account not found");
  return sub;
}

export async function createSnapshotAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAgencyAdmin();
    const source = await agencySubAccount(user.agencyId, str(formData, "subAccountId"));
    const name = str(formData, "name").trim() || `${source.name} snapshot`;
    const data = await captureSnapshot(tenantDb(source.id));
    await prisma.snapshot.create({
      data: { agencyId: user.agencyId, name, sourceSubAccountId: source.id, data: JSON.stringify(data) },
    });
    revalidatePath("/agency");
    return `Snapshot "${name}" saved`;
  });
}

export async function applySnapshotAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAgencyAdmin();
    const snapshot = await prisma.snapshot.findFirst({ where: { id: str(formData, "snapshotId"), agencyId: user.agencyId } });
    if (!snapshot) throw new Error("Snapshot not found");
    const target = await agencySubAccount(user.agencyId, str(formData, "subAccountId"));
    const summary = await applySnapshot(tenantDb(target.id), parseSnapshotData(snapshot.data));
    revalidatePath("/", "layout");
    return `Applied to "${target.name}": ${summary.pipelines} pipeline(s), ${summary.campaigns} campaign(s), ${summary.workflows} workflow(s). Workflows arrive switched off.`;
  });
}

export async function deleteSnapshotAction(snapshotId: string): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAgencyAdmin();
    await prisma.snapshot.deleteMany({ where: { id: snapshotId, agencyId: user.agencyId } });
    revalidatePath("/agency");
  });
}

/** APP_URL when configured (recommended in production), else the request host. */
async function appBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

export async function inviteMemberAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requirePermission("team:manage");
    const { link } = await inviteMember({
      subAccountId: ctx.subAccount.id,
      agencyId: ctx.user.agencyId,
      invitedById: ctx.user.id,
      email: str(formData, "email"),
      role: str(formData, "role"),
      baseUrl: await appBaseUrl(),
    });
    revalidatePath("/settings");
    return `Invitation sent (see Outbox). Link: ${link}`;
  });
}

export async function updateMemberRoleAction(membershipId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requirePermission("team:manage");
    await updateMemberRole(ctx.subAccount.id, membershipId, str(formData, "role"));
    revalidatePath("/settings");
  });
}

export async function removeMemberAction(membershipId: string): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requirePermission("team:manage");
    await removeMember(ctx.subAccount.id, membershipId);
    revalidatePath("/settings");
  });
}
