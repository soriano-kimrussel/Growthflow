import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, contactName, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { formatDate } from "@/lib/time";
import { contactOptions } from "@/modules/contacts/service";
import { createTaskAction, toggleTaskAction } from "@/modules/tasks/actions";
import { listOpenTasks } from "@/modules/tasks/service";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { db, subAccount } = await requireTenant();
  const [tasks, contacts] = await Promise.all([listOpenTasks(db), contactOptions(db)]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Tasks" description="Open tasks, including ones created by workflows." />
      <Card className="mb-6">
        <ActionForm action={createTaskAction.bind(null, null)} resetOnSuccess className="flex flex-wrap gap-2" aria-label="New task">
          <Input name="title" required placeholder="Task title" className="min-w-0 flex-1" aria-label="Task title" />
          <Select name="contactId" className="w-56" aria-label="Contact">
            <option value="">No contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
          </Select>
          <Input name="dueDate" type="date" className="w-40" aria-label="Due date" />
          <SubmitButton>Add task</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        {tasks.length ? (
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-500">
                    {t.contact ? (
                      <Link className="hover:underline" href={`/contacts/${t.contact.id}`}>
                        {contactName(t.contact)}
                      </Link>
                    ) : (
                      "No contact"
                    )}
                    {t.dueAt ? (
                      <span className={t.dueAt < now ? "ml-2 font-medium text-red-600" : "ml-2"}>due {formatDate(t.dueAt, subAccount.timezone)}</span>
                    ) : null}
                  </p>
                </div>
                <ActionButton action={toggleTaskAction.bind(null, t.id, true)}>Complete</ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="All caught up" />
        )}
      </Card>
    </>
  );
}
