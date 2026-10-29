import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { tenantDb } from "@/lib/db/tenant";

/** A fresh agency with two sub-accounts (A and B) and tenant clients for each. */
export async function makeTenants() {
  const suffix = randomUUID().slice(0, 8);
  const agency = await prisma.agency.create({ data: { name: `Agency ${suffix}` } });
  const a = await prisma.subAccount.create({ data: { agencyId: agency.id, name: `A ${suffix}` } });
  const b = await prisma.subAccount.create({ data: { agencyId: agency.id, name: `B ${suffix}` } });
  return { agency, a, b, dbA: tenantDb(a.id), dbB: tenantDb(b.id) };
}

export const at = (iso: string) => new Date(iso);
