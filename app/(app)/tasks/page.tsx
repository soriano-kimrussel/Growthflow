import Link from "next/link";
import { CheckCircle2, ListTodo, Plus } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar, Badge, Card, contactName, EmptyState, Input, PageHeader, Select } from "@/components/ui";
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
  const overdue = tasks.filter((t) => t.dueAt && t.dueAt < now).length;

  return (
    <>
      <PageHeader
        title="Tasks"
        description={
          <span className="flex items-center gap-2">
            {tasks.length} open{overdue ? <Badge tone="red">{overdue} overdue</Badge> : null}
          </span>
        }
      />
      <Card title="New task" icon={Plus} className="mb-6">
        <ActionForm action={createTaskAction.bind(null, null)} resetOnSuccess className="flex flex-wrap gap-2" aria-label="New task">
          <Input name="title" required placeholder="What needs doing?" className="min-w-0 flex-1" aria-label="Task title" />
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
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {tasks.length ? (
          <ul className="divide-y divide-line">
            {tasks.map((t) => {
              const late = t.dueAt && t.dueAt < now;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <ListTodo className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{t.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        {t.contact ? (
                          <Link className="inline-flex items-center gap-1.5 hover:underline" href={`/contacts/${t.contact.id}`}>
                            <Avatar name={contactName(t.contact)} size="xs" />
                            {contactName(t.contact)}
                          </Link>
                        ) : (
                          "No contact"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {t.dueAt ? <Badge tone={late ? "red" : "slate"}>{late ? "Overdue · " : "Due "}{formatDate(t.dueAt, subAccount.timezone)}</Badge> : null}
                    <ActionButton action={toggleTaskAction.bind(null, t.id, true)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6">
            <EmptyState title="All caught up" icon={CheckCircle2} />
          </div>
        )}
      </section>
    </>
  );
}
