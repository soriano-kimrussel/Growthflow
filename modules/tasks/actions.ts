"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction, str } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { zonedWallTimeToUtc } from "@/lib/time";
import { createTask, setTaskCompleted } from "./service";

export async function createTaskAction(contactId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db, subAccount } = await requirePermission("tasks:write");
    const due = str(formData, "dueDate");
    await createTask(db, {
      title: str(formData, "title"),
      contactId: contactId ?? (str(formData, "contactId") || null),
      dueAt: due ? zonedWallTimeToUtc(`${due}T09:00`, subAccount.timezone) : null,
    });
    revalidatePath("/", "layout");
  });
}

export async function toggleTaskAction(taskId: string, completed: boolean): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("tasks:write");
    await setTaskCompleted(db, taskId, completed);
    revalidatePath("/", "layout");
  });
}
