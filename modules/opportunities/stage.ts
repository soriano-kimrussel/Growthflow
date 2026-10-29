import type { TenantDb } from "@/lib/db/tenant";
import { logActivity } from "@/modules/timeline/service";

export interface StageChange {
  opportunityId: string;
  contactId: string;
  pipelineId: string;
  fromStageId: string;
  toStageId: string;
}

/**
 * Moves an opportunity to another stage of the same pipeline and logs it on the
 * contact's timeline. Returns null when nothing changed. Does not emit workflow
 * triggers; the caller does (see opportunities/service.ts and the engine).
 */
export async function applyStageChange(
  db: TenantDb,
  opportunityId: string,
  toStageId: string,
  via?: string,
): Promise<StageChange | null> {
  const opportunity = await db.opportunity.findFirst({
    where: { id: opportunityId },
    include: { stage: true },
  });
  if (!opportunity) throw new Error("Opportunity not found");
  const toStage = await db.stage.findFirst({ where: { id: toStageId, pipelineId: opportunity.pipelineId } });
  if (!toStage) throw new Error("Stage does not belong to this opportunity's pipeline");
  if (toStage.id === opportunity.stageId) return null;

  await db.opportunity.update({ where: { id: opportunity.id }, data: { stageId: toStage.id } });
  await logActivity(
    db,
    opportunity.contactId,
    "stage_changed",
    `"${opportunity.title}" moved from ${opportunity.stage.name} to ${toStage.name}`,
    via ? `via ${via}` : null,
  );
  return {
    opportunityId: opportunity.id,
    contactId: opportunity.contactId,
    pipelineId: opportunity.pipelineId,
    fromStageId: opportunity.stageId,
    toStageId: toStage.id,
  };
}
