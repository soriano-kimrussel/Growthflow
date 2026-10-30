import { FastForward, Play } from "lucide-react";
import { processDueAction, skipWaitsAction } from "@/modules/workflows/actions";
import { ActionButton } from "./action-button";

/** "Process due steps" plus a demo-only "skip waits" shortcut. */
export function RunnerControls() {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionButton action={processDueAction} variant="soft" size="md">
        <Play className="h-3.5 w-3.5" /> Process due steps
      </ActionButton>
      <ActionButton
        action={skipWaitsAction}
        variant="secondary"
        size="md"
        title="Makes every pending wait in this sub-account due now, then processes"
      >
        <FastForward className="h-3.5 w-3.5" /> Skip waits (demo)
      </ActionButton>
    </div>
  );
}
