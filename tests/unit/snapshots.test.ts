import { describe, expect, it } from "vitest";
import { createContact } from "@/modules/contacts/service";
import { addCampaignStep, createCampaign } from "@/modules/campaigns/service";
import { createPipeline } from "@/modules/opportunities/service";
import { applySnapshot, captureSnapshot, parseSnapshotData, remapRefs } from "@/modules/snapshots/service";
import { addAction, createWorkflow, setWorkflowActive } from "@/modules/workflows/service";
import { makeTenants } from "../support/factory";

describe("snapshots", () => {
  it("clones structure (not contacts) and remaps stage references", async () => {
    const { dbA, dbB } = await makeTenants();
    const pipeline = await createPipeline(dbA, "Sales", ["New", "Booked", "Won"]);
    const stages = await dbA.stage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { position: "asc" } });
    const campaign = await createCampaign(dbA, "Nurture");
    await addCampaignStep(dbA, campaign.id, { type: "email", subject: "Hi", body: "Hello" });
    const workflow = await createWorkflow(dbA, {
      name: "On booked",
      triggerType: "opportunity_stage_changed",
      triggerConfig: { pipelineId: pipeline.id, stageId: stages[1].id },
    });
    await addAction(dbA, workflow.id, "move_opportunity", { pipelineId: pipeline.id, stageId: stages[2].id });
    await setWorkflowActive(dbA, workflow.id, true);
    await createContact(dbA, { firstName: "Not copied" });

    // Round-trip through JSON like the stored Snapshot row.
    const data = parseSnapshotData(JSON.stringify(await captureSnapshot(dbA)));
    const summary = await applySnapshot(dbB, data);
    expect(summary).toMatchObject({ pipelines: 1, campaigns: 1, workflows: 1, skippedActions: 0 });

    expect(await dbB.contact.count()).toBe(0);
    const newPipeline = await dbB.pipeline.findFirstOrThrow({ include: { stages: { orderBy: { position: "asc" } } } });
    expect(newPipeline.stages.map((s) => s.name)).toEqual(["New", "Booked", "Won"]);
    expect(newPipeline.id).not.toBe(pipeline.id);

    const newWorkflow = await dbB.workflow.findFirstOrThrow({ include: { actions: true } });
    expect(newWorkflow.active).toBe(false);
    expect(JSON.parse(newWorkflow.triggerConfig)).toEqual({ pipelineId: newPipeline.id, stageId: newPipeline.stages[1].id });
    expect(JSON.parse(newWorkflow.actions[0].config)).toEqual({ pipelineId: newPipeline.id, stageId: newPipeline.stages[2].id });

    const newCampaign = await dbB.campaign.findFirstOrThrow({ include: { steps: true } });
    expect(newCampaign).toMatchObject({ name: "Nurture", status: "draft" });
    expect(newCampaign.steps).toHaveLength(1);
  });

  it("drops references it cannot map", () => {
    expect(remapRefs({ stageId: "old", tag: "x" }, new Map())).toEqual({ tag: "x" });
    expect(remapRefs({ stageId: "old" }, new Map([["old", "new"]]))).toEqual({ stageId: "new" });
  });
});
