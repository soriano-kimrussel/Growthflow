import type { TenantDb } from "@/lib/db/tenant";
import { upcomingAppointments } from "@/modules/appointments/service";
import { recentActivity } from "@/modules/timeline/service";

export async function getDashboard(db: TenantDb, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [
    contactCount,
    openOpps,
    upcoming,
    activity,
    activeCampaigns,
    enrollmentsByStatus,
    messagesByChannel,
    activeWorkflows,
    activeRuns,
    openTasks,
    payments,
  ] = await Promise.all([
    db.contact.count(),
    db.opportunity.aggregate({ where: { status: "open" }, _count: { _all: true }, _sum: { value: true } }),
    upcomingAppointments(db, now, 5),
    recentActivity(db, 12),
    db.campaign.count({ where: { status: "active" } }),
    db.campaignEnrollment.groupBy({ by: ["status"], _count: { _all: true } }),
    db.message.groupBy({ by: ["channel"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.workflow.count({ where: { active: true } }),
    db.workflowRun.count({ where: { status: "active" } }),
    db.task.count({ where: { completedAt: null } }),
    db.payment.aggregate({ where: { status: "succeeded" }, _sum: { amount: true } }),
  ]);

  // Open deals per stage of the first pipeline, for the pipeline chart.
  const pipeline = await db.pipeline.findFirst({ orderBy: { createdAt: "asc" }, include: { stages: { orderBy: { position: "asc" } } } });
  const byStage = pipeline
    ? await db.opportunity.groupBy({
        by: ["stageId"],
        where: { pipelineId: pipeline.id, status: "open" },
        _count: { _all: true },
        _sum: { value: true },
      })
    : [];
  const stageTotals = new Map(byStage.map((s) => [s.stageId, { count: s._count._all, value: s._sum.value ?? 0 }]));
  const pipelineStages = pipeline
    ? {
        id: pipeline.id,
        name: pipeline.name,
        stages: pipeline.stages.map((s) => ({ id: s.id, name: s.name, ...(stageTotals.get(s.id) ?? { count: 0, value: 0 }) })),
      }
    : null;
  const wonValue = await db.opportunity.aggregate({ where: { status: "won" }, _count: { _all: true }, _sum: { value: true } });

  const enrollments = Object.fromEntries(enrollmentsByStatus.map((e) => [e.status, e._count._all]));
  const messages = Object.fromEntries(messagesByChannel.map((m) => [m.channel, m._count._all]));

  return {
    contactCount,
    openOpportunityCount: openOpps._count._all,
    openOpportunityValue: openOpps._sum.value ?? 0,
    upcoming,
    activity,
    campaigns: {
      active: activeCampaigns,
      enrolledActive: enrollments.active ?? 0,
      completed: enrollments.completed ?? 0,
      emails30d: messages.email ?? 0,
      sms30d: messages.sms ?? 0,
    },
    activeWorkflows,
    activeRuns,
    openTasks,
    collected: payments._sum.amount ?? 0,
    pipeline: pipelineStages,
    wonCount: wonValue._count._all,
    wonValue: wonValue._sum.value ?? 0,
  };
}
