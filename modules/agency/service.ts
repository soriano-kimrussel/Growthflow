import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { tenantDb } from "@/lib/db/tenant";
import { hashPassword } from "@/lib/auth/password";
import { isOneOf } from "@/lib/domain";
import { SUB_ACCOUNT_ROLES, type SubAccountRole } from "@/lib/auth/permissions";
import { createPipeline, DEFAULT_STAGES } from "@/modules/opportunities/service";
import { getMessagingProvider } from "@/lib/providers/messaging";

// Platform-level operations: agencies, sub-accounts, users, invitations.
// These use the system client because they manage the tenants themselves;
// anything inside a sub-account still goes through tenantDb().

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export async function createSubAccount(agencyId: string, name: string, timezone = "UTC") {
  if (!name.trim()) throw new Error("Sub-account name is required");
  if (!isValidTimeZone(timezone)) throw new Error("Unknown time zone");
  const subAccount = await prisma.subAccount.create({ data: { agencyId, name: name.trim(), timezone } });
  await createPipeline(tenantDb(subAccount.id), "Sales Pipeline", DEFAULT_STAGES);
  return subAccount;
}

export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists");
  }
}

/** Signup: a new agency, its first Agency Admin, and a starter sub-account. */
export async function signUpAgency(input: { agencyName: string; name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new EmailTakenError();
  const passwordHash = await hashPassword(input.password);
  const agency = await prisma.agency.create({ data: { name: input.agencyName.trim() } });
  const user = await prisma.user.create({
    data: { agencyId: agency.id, email, name: input.name.trim(), passwordHash, isAgencyAdmin: true },
  });
  const subAccount = await createSubAccount(agency.id, `${agency.name} - Main`);
  return { agency, user, subAccount };
}

export function listSubAccounts(agencyId: string) {
  return prisma.subAccount.findMany({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { contacts: true, memberships: true } } },
  });
}

export function listMembers(subAccountId: string) {
  return prisma.membership.findMany({
    where: { subAccountId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export function listPendingInvitations(subAccountId: string) {
  return prisma.invitation.findMany({
    where: { subAccountId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

const INVITE_TTL_MS = 7 * 86_400_000;

/**
 * Creates an invitation and "emails" the link through the messaging adapter
 * (so with the simulated provider it shows up in the sub-account's Outbox).
 */
export async function inviteMember(input: {
  subAccountId: string;
  agencyId: string;
  invitedById: string;
  email: string;
  role: string;
  baseUrl: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!isOneOf(SUB_ACCOUNT_ROLES, input.role)) throw new Error("Invalid role");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.agencyId !== input.agencyId) throw new Error("That email belongs to another agency");
  if (existing?.isAgencyAdmin) throw new Error("Agency admins already have access to every sub-account");
  if (existing) {
    const member = await prisma.membership.findUnique({
      where: { userId_subAccountId: { userId: existing.id, subAccountId: input.subAccountId } },
    });
    if (member) throw new Error("That user is already a member");
  }
  const token = randomBytes(24).toString("base64url");
  const invitation = await prisma.invitation.create({
    data: {
      token,
      email,
      role: input.role,
      subAccountId: input.subAccountId,
      invitedById: input.invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  const link = `${input.baseUrl}/invite/${token}`;
  await getMessagingProvider(tenantDb(input.subAccountId)).sendEmail({
    contactId: null,
    to: email,
    subject: "You're invited to GrowthFlow",
    body: `You've been invited to join as ${input.role === "admin" ? "an admin" : "a user"}. Accept: ${link}`,
    source: "system",
    sourceId: invitation.id,
  });
  return { invitation, link };
}

export function findOpenInvitation(token: string) {
  return prisma.invitation.findFirst({
    where: { token, acceptedAt: null, expiresAt: { gt: new Date() } },
    include: { subAccount: { include: { agency: true } } },
  });
}

/** Accepts an invitation for an existing (already verified) or new user. */
export async function acceptInvitation(token: string, newUser?: { name: string; password: string }) {
  const invitation = await findOpenInvitation(token);
  if (!invitation) throw new Error("This invitation is invalid or has expired");
  const agencyId = invitation.subAccount.agencyId;
  let user = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (!user) {
    if (!newUser) throw new Error("Create a password to accept");
    user = await prisma.user.create({
      data: {
        agencyId,
        email: invitation.email,
        name: newUser.name.trim(),
        passwordHash: await hashPassword(newUser.password),
      },
    });
  } else if (user.agencyId !== agencyId) {
    throw new Error("That email belongs to another agency");
  }
  await prisma.membership.upsert({
    where: { userId_subAccountId: { userId: user.id, subAccountId: invitation.subAccountId } },
    create: { userId: user.id, subAccountId: invitation.subAccountId, role: invitation.role as SubAccountRole },
    update: { role: invitation.role },
  });
  await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  return { user, subAccountId: invitation.subAccountId };
}

export async function updateMemberRole(subAccountId: string, membershipId: string, role: string) {
  if (!isOneOf(SUB_ACCOUNT_ROLES, role)) throw new Error("Invalid role");
  const { count } = await prisma.membership.updateMany({ where: { id: membershipId, subAccountId }, data: { role } });
  if (count !== 1) throw new Error("Member not found");
}

export async function removeMember(subAccountId: string, membershipId: string) {
  const { count } = await prisma.membership.deleteMany({ where: { id: membershipId, subAccountId } });
  if (count !== 1) throw new Error("Member not found");
}
