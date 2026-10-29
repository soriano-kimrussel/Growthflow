import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processAllTenants } from "@/modules/automation/runner";

/**
 * Advances every due workflow run and campaign enrollment, across all
 * sub-accounts. Call it on a schedule:
 *   - Vercel Cron (vercel.json) sends GET with `Authorization: Bearer $CRON_SECRET`
 *   - locally: curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/runner
 */

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await processAllTenants(new Date());
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
