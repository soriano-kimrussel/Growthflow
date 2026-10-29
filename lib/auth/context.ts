import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { tenantDb, type TenantDb } from "@/lib/db/tenant";
import { assertCan, type Permission, type Role } from "./permissions";
import { readSession } from "./session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  agencyId: string;
  isAgencyAdmin: boolean;
}

export interface SubAccountSummary {
  id: string;
  name: string;
  timezone: string;
  role: Role;
}

export interface TenantContext {
  sessionId: string;
  user: SessionUser;
  subAccount: SubAccountSummary;
  role: Role;
  /** Every sub-account this user may switch to. */
  accessible: SubAccountSummary[];
  /** A Prisma client that can only see `subAccount`'s rows. */
  db: TenantDb;
}

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const { user } = session;
  return {
    sessionId: session.id,
    activeSubAccountId: session.activeSubAccountId,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      agencyId: user.agencyId,
      isAgencyAdmin: user.isAgencyAdmin,
    } satisfies SessionUser,
  };
});

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

/** Sub-accounts a user can work in, with their effective role in each. */
export async function listAccessibleSubAccounts(user: SessionUser): Promise<SubAccountSummary[]> {
  if (user.isAgencyAdmin) {
    const rows = await prisma.subAccount.findMany({
      where: { agencyId: user.agencyId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((s) => ({ id: s.id, name: s.name, timezone: s.timezone, role: "agency_admin" }));
  }
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, subAccount: { agencyId: user.agencyId } },
    include: { subAccount: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.subAccount.id,
    name: m.subAccount.name,
    timezone: m.subAccount.timezone,
    role: m.role === "admin" ? "admin" : "user",
  }));
}

/**
 * Resolves who is acting and in which sub-account, entirely from the session
 * cookie. Returns null when the user has no sub-account to work in yet.
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const current = await requireUser();
  const accessible = await listAccessibleSubAccounts(current.user);
  const active =
    accessible.find((s) => s.id === current.activeSubAccountId) ?? accessible[0] ?? null;
  if (!active) return null;
  return {
    sessionId: current.sessionId,
    user: current.user,
    subAccount: active,
    role: active.role,
    accessible,
    db: tenantDb(active.id),
  };
});

/** Tenant context for pages: sends users without a sub-account somewhere useful. */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) {
    const current = await requireUser();
    redirect(current.user.isAgencyAdmin ? "/agency" : "/no-access");
  }
  return ctx;
}

/** Tenant context for mutations: also enforces the role check. */
export async function requirePermission(permission: Permission): Promise<TenantContext> {
  const ctx = await requireTenant();
  assertCan(ctx.role, permission);
  return ctx;
}

/** Agency-level context (agency admins only). */
export async function requireAgencyAdmin() {
  const current = await requireUser();
  assertCan(current.user.isAgencyAdmin ? "agency_admin" : "user", "agency:manage");
  return current;
}
