import "server-only";
import { prisma } from "./prisma";

/**
 * Tenant isolation lives here.
 *
 * `tenantDb(subAccountId)` returns a Prisma client that can only touch rows of
 * one sub-account:
 *   - reads, updates and deletes get `subAccountId` merged into `where`
 *   - creates get `subAccountId` stamped onto `data`
 *   - a query that names a *different* subAccountId throws
 *   - platform (non-tenant) models are blocked entirely
 *
 * Every server action resolves the sub-account from the session on the server
 * (lib/auth/context.ts) and only ever receives one of these clients, so there
 * is no code path that can read or write across sub-accounts.
 *
 * Nested writes (`create: { tags: { create: ... } }`) are not scoped by the
 * extension, so services use flat, unchecked writes (scalar foreign keys) and
 * verify referenced ids with `assertOwned` before linking them.
 */

export const TENANT_MODELS = new Set([
  "Contact",
  "Tag",
  "ContactTag",
  "Note",
  "Activity",
  "Task",
  "Pipeline",
  "Stage",
  "Opportunity",
  "Appointment",
  "Campaign",
  "CampaignStep",
  "CampaignEnrollment",
  "Workflow",
  "WorkflowAction",
  "WorkflowRun",
  "Message",
  "Payment",
]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

type Row = Record<string, unknown>;

function scopeWhere(where: unknown, subAccountId: string): Row {
  const w = (where ?? {}) as Row;
  if (w.subAccountId !== undefined && w.subAccountId !== subAccountId) {
    throw new TenantScopeError("Query targets a different sub-account");
  }
  return { ...w, subAccountId };
}

function scopeData(data: unknown, subAccountId: string): Row {
  const d = (data ?? {}) as Row;
  if (d.subAccountId !== undefined && d.subAccountId !== subAccountId) {
    throw new TenantScopeError("Write targets a different sub-account");
  }
  return { ...d, subAccountId };
}

function assertNoScopeChange(data: unknown, subAccountId: string) {
  const d = (data ?? {}) as Row;
  if (d.subAccountId !== undefined && d.subAccountId !== subAccountId) {
    throw new TenantScopeError("Rows cannot be moved between sub-accounts");
  }
}

/** Pure argument rewriting, exported for unit tests. */
export function scopeArgs(operation: string, args: unknown, subAccountId: string): Row {
  const a = { ...((args ?? {}) as Row) };
  if (WHERE_OPS.has(operation)) {
    a.where = scopeWhere(a.where, subAccountId);
    if (operation.startsWith("update")) assertNoScopeChange(a.data, subAccountId);
    return a;
  }
  if (CREATE_OPS.has(operation)) {
    a.data = Array.isArray(a.data)
      ? a.data.map((d) => scopeData(d, subAccountId))
      : scopeData(a.data, subAccountId);
    return a;
  }
  if (operation === "upsert") {
    a.where = scopeWhere(a.where, subAccountId);
    a.create = scopeData(a.create, subAccountId);
    assertNoScopeChange(a.update, subAccountId);
    return a;
  }
  throw new TenantScopeError(`Operation "${operation}" is not allowed on tenant models`);
}

export function tenantDb(subAccountId: string) {
  if (!subAccountId) throw new TenantScopeError("tenantDb requires a subAccountId");
  return prisma.$extends({
    name: "tenant-scope",
    // Lets services stamp creates explicitly; the query hook still verifies it.
    client: { $subAccountId: subAccountId },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            throw new TenantScopeError(`Model "${model}" is not reachable through a tenant client`);
          }
          return query(scopeArgs(operation, args, subAccountId) as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;

/** Lookup-by-id delegate shape shared by every tenant model. */
type FindById = { findFirst(args: { where: { id: string }; select: { id: true } }): Promise<unknown> };

/**
 * Throws unless `id` exists in the scoped client's sub-account. Use before
 * linking a client-supplied foreign key (e.g. an opportunity's contactId).
 */
export async function assertOwned(delegate: FindById, id: string, label = "Record") {
  const row = await delegate.findFirst({ where: { id }, select: { id: true } });
  if (!row) throw new TenantScopeError(`${label} not found`);
}
