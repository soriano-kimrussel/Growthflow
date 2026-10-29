import type { TenantDb } from "@/lib/db/tenant";
import { listPipelines } from "@/modules/opportunities/service";

/** Stage choices for workflow editors, plus an id -> name map for summaries. */
export async function stageOptions(db: TenantDb) {
  const pipelines = await listPipelines(db);
  const options = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ value: `${p.id}:${s.id}`, label: `${p.name} → ${s.name}` })),
  );
  const names = Object.fromEntries(pipelines.flatMap((p) => p.stages.map((s) => [s.id, `${p.name} → ${s.name}`])));
  return { options, names };
}
