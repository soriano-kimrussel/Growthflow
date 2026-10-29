import { processDueAction, skipWaitsAction } from "@/modules/workflows/actions";
import { ActionButton } from "./action-button";

/** "Process due steps" plus a demo-only "skip waits" shortcut. */
export function RunnerControls() {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionButton action={processDueAction} variant="primary" size="md">
        Process due steps
      </ActionButton>
      <ActionButton
        action={skipWaitsAction}
        variant="secondary"
        size="md"
        title="Makes every pending wait in this sub-account due now, then processes"
      >
        Skip waits (demo)
      </ActionButton>
    </div>
  );
}
