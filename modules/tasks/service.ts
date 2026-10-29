import type { TenantDb } from "@/lib/db/tenant";
import { assertOwned } from "@/lib/db/tenant";
import { logActivity } from "@/modules/timeline/service";

export async function createTask(db: TenantDb, input: { title: string; contactId?: string | null; dueAt?: Date | null }) {
  if (!input.title.trim()) throw new Error("Task title is required");
  if (input.contactId) await assertOwned(db.contact, input.contactId, "Contact");
  const task = await db.task.create({
    data: {
      subAccountId: db.$subAccountId,
      title: input.title.trim(),
      contactId: input.contactId ?? null,
      dueAt: input.dueAt ?? null,
    },
  });
  if (task.contactId) await logActivity(db, task.contactId, "task_created", `Task created: ${task.title}`);
  return task;
}

export async function setTaskCompleted(db: TenantDb, taskId: string, completed: boolean, now = new Date()) {
  return db.task.update({ where: { id: taskId }, data: { completedAt: completed ? now : null } });
}

export function listOpenTasks(db: TenantDb, take = 100) {
  return db.task.findMany({
    where: { completedAt: null },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    take,
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
}
