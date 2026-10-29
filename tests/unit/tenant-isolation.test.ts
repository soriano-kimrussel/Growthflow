import { beforeAll, describe, expect, it } from "vitest";
import { assertOwned, scopeArgs, TenantScopeError, type TenantDb } from "@/lib/db/tenant";
import { createContact, listContacts } from "@/modules/contacts/service";
import { createOpportunity, createPipeline, moveOpportunity } from "@/modules/opportunities/service";
import { bookAppointment } from "@/modules/appointments/service";
import { makeTenants } from "../support/factory";

describe("scopeArgs (pure)", () => {
  it("adds the sub-account to reads and refuses a different one", () => {
    expect(scopeArgs("findMany", { where: { firstName: "x" } }, "A")).toEqual({ where: { firstName: "x", subAccountId: "A" } });
    expect(scopeArgs("count", undefined, "A")).toEqual({ where: { subAccountId: "A" } });
    expect(() => scopeArgs("findMany", { where: { subAccountId: "B" } }, "A")).toThrow(TenantScopeError);
  });

  it("stamps creates, including batches, and refuses foreign rows", () => {
    expect(scopeArgs("create", { data: { name: "t" } }, "A")).toEqual({ data: { name: "t", subAccountId: "A" } });
    expect(scopeArgs("createMany", { data: [{ n: 1 }, { n: 2 }] }, "A")).toEqual({
      data: [
        { n: 1, subAccountId: "A" },
        { n: 2, subAccountId: "A" },
      ],
    });
    expect(() => scopeArgs("create", { data: { subAccountId: "B" } }, "A")).toThrow(TenantScopeError);
  });

  it("forbids moving a row to another sub-account", () => {
    expect(() => scopeArgs("update", { where: { id: "1" }, data: { subAccountId: "B" } }, "A")).toThrow(TenantScopeError);
    expect(() => scopeArgs("upsert", { where: { id: "1" }, create: {}, update: { subAccountId: "B" } }, "A")).toThrow(
      TenantScopeError,
    );
  });
});

describe("tenant-scoped client", () => {
  let dbA: TenantDb;
  let dbB: TenantDb;
  let contactA: { id: string };
  let contactB: { id: string };

  beforeAll(async () => {
    ({ dbA, dbB } = await makeTenants());
    contactA = await createContact(dbA, { firstName: "Alice", email: "alice@a.test", tags: "shared-tag" });
    contactB = await createContact(dbB, { firstName: "Bob", email: "bob@b.test", tags: "shared-tag" });
  });

  it("a query scoped to sub-account A never returns sub-account B's rows", async () => {
    const rowsA = await dbA.contact.findMany();
    expect(rowsA.map((c) => c.id)).toEqual([contactA.id]);
    expect(await dbA.contact.count()).toBe(1);

    // Same tag name exists in both tenants; the filter stays inside A.
    const tagged = await listContacts(dbA, { tag: "shared-tag" });
    expect(tagged.rows.map((c) => c.id)).toEqual([contactA.id]);

    // Activities, tags and join rows are scoped too.
    const activityContacts = new Set((await dbA.activity.findMany()).map((a) => a.contactId));
    expect([...activityContacts]).toEqual([contactA.id]);
    expect((await dbA.tag.findMany()).every((t) => t.subAccountId === dbA.$subAccountId)).toBe(true);
  });

  it("cannot read another tenant's row even by exact id", async () => {
    expect(await dbA.contact.findUnique({ where: { id: contactB.id } })).toBeNull();
    expect(await dbA.contact.findFirst({ where: { id: contactB.id } })).toBeNull();
    await expect(assertOwned(dbA.contact, contactB.id, "Contact")).rejects.toThrow("Contact not found");
  });

  it("cannot update or delete another tenant's row", async () => {
    await expect(dbA.contact.update({ where: { id: contactB.id }, data: { firstName: "Hacked" } })).rejects.toThrow();
    const { count } = await dbA.contact.updateMany({ where: { id: contactB.id }, data: { firstName: "Hacked" } });
    expect(count).toBe(0);
    await expect(dbA.contact.delete({ where: { id: contactB.id } })).rejects.toThrow();
    const stillThere = await dbB.contact.findFirst({ where: { id: contactB.id } });
    expect(stillThere?.firstName).toBe("Bob");
  });

  it("cannot write a row into another tenant", async () => {
    await expect(
      dbA.contact.create({ data: { subAccountId: dbB.$subAccountId, firstName: "Mallory" } }),
    ).rejects.toThrow(TenantScopeError);
  });

  it("blocks platform models entirely", async () => {
    const unsafe = dbA as unknown as { user: { findMany(): Promise<unknown> } };
    await expect(unsafe.user.findMany()).rejects.toThrow(TenantScopeError);
  });

  it("refuses to link records across tenants", async () => {
    const pipelineA = await createPipeline(dbA, "Sales", ["New", "Won"]);
    const stagesA = await dbA.stage.findMany({ where: { pipelineId: pipelineA.id }, orderBy: { position: "asc" } });
    await expect(
      createOpportunity(dbA, { pipelineId: pipelineA.id, stageId: stagesA[0].id, contactId: contactB.id, title: "x", value: 0 }),
    ).rejects.toThrow("Contact not found");
    await expect(
      bookAppointment(dbA, { contactId: contactB.id, title: "x", startAt: new Date(), endAt: new Date(Date.now() + 1000) }),
    ).rejects.toThrow("Contact not found");

    const pipelineB = await createPipeline(dbB, "Sales", ["New", "Won"]);
    const stagesB = await dbB.stage.findMany({ where: { pipelineId: pipelineB.id }, orderBy: { position: "asc" } });
    const oppA = await createOpportunity(dbA, {
      pipelineId: pipelineA.id,
      stageId: stagesA[0].id,
      contactId: contactA.id,
      title: "Deal",
      value: 1000,
    });
    // A's opportunity cannot be moved into B's stage, and B cannot move A's opportunity.
    await expect(moveOpportunity(dbA, oppA.id, stagesB[1].id)).rejects.toThrow();
    await expect(moveOpportunity(dbB, oppA.id, stagesB[1].id)).rejects.toThrow("Opportunity not found");
  });
});
