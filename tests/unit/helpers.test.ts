import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/permissions";
import { formatCents, parseMoneyToCents } from "@/lib/money";
import { renderTemplate } from "@/lib/templates";
import { toWallTime, zonedDateKey, zonedWallTimeToUtc } from "@/lib/time";
import { parseCustomFields } from "@/modules/contacts/service";
import { parseTagList } from "@/modules/tags/service";
import { matchesTrigger } from "@/modules/workflows/types";

describe("permissions", () => {
  it("ranks agency admin > sub-account admin > user", () => {
    expect(can("user", "contacts:write")).toBe(true);
    expect(can("user", "contacts:delete")).toBe(false);
    expect(can("user", "workflows:manage")).toBe(false);
    expect(can("admin", "workflows:manage")).toBe(true);
    expect(can("admin", "agency:manage")).toBe(false);
    expect(can("agency_admin", "agency:manage")).toBe(true);
    expect(can("agency_admin", "contacts:delete")).toBe(true);
  });
});

describe("templates", () => {
  it("renders merge fields and blanks unknown ones", () => {
    const contact = { firstName: "Ada", lastName: "Lovelace", email: "ada@x.test", phone: null, company: "Engines", customFields: '{"plan":"pro"}' };
    expect(renderTemplate("Hi {{ first_name }} ({{full_name}}) at {{company}} on {{custom.plan}}{{nope}}", contact)).toBe(
      "Hi Ada (Ada Lovelace) at Engines on pro",
    );
  });
});

describe("money", () => {
  it("parses dollars to integer cents", () => {
    expect(parseMoneyToCents("1,250.5")).toBe(125050);
    expect(parseMoneyToCents("$99")).toBe(9900);
    expect(parseMoneyToCents("0.07")).toBe(7);
    expect(parseMoneyToCents("1.234")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(formatCents(125050)).toBe("$1,250.50");
    expect(formatCents(9900)).toBe("$99");
  });
});

describe("time zones", () => {
  it("converts wall time in a zone to UTC, across DST", () => {
    expect(zonedWallTimeToUtc("2026-01-15T09:30", "America/New_York").toISOString()).toBe("2026-01-15T14:30:00.000Z");
    expect(zonedWallTimeToUtc("2026-07-15T09:30", "America/New_York").toISOString()).toBe("2026-07-15T13:30:00.000Z");
    expect(zonedWallTimeToUtc("2026-07-15T09:30", "UTC").toISOString()).toBe("2026-07-15T09:30:00.000Z");
    expect(toWallTime(new Date("2026-07-15T13:30:00Z"), "America/New_York")).toBe("2026-07-15T09:30");
    expect(zonedDateKey(new Date("2026-07-16T02:00:00Z"), "America/Los_Angeles")).toBe("2026-07-15");
  });
});

describe("parsers", () => {
  it("normalizes tags and custom fields", () => {
    expect(parseTagList(" VIP, new lead ,vip,")).toEqual(["vip", "new-lead"]);
    expect(parseCustomFields("Plan: Pro\nlead source : Ads\nbad line\n: empty")).toEqual({ plan: "Pro", lead_source: "Ads" });
  });

  it("matches trigger filters", () => {
    expect(matchesTrigger("contact_tag_added", { tag: "VIP" }, { type: "contact_tag_added", contactId: "c", tag: "vip" })).toBe(true);
    expect(matchesTrigger("contact_tag_added", { tag: "vip" }, { type: "contact_tag_added", contactId: "c", tag: "x" })).toBe(false);
    expect(matchesTrigger("contact_created", {}, { type: "contact_tag_added", contactId: "c", tag: "x" })).toBe(false);
  });
});
