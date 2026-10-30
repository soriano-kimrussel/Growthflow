import {
  ArrowRightLeft,
  CalendarCheck,
  CircleDot,
  CreditCard,
  ListTodo,
  Megaphone,
  Pencil,
  Send,
  StickyNote,
  Tag,
  Target,
  UserPlus,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";

const ACTIVITY: Record<string, { icon: LucideIcon; tone: string }> = {
  contact_created: { icon: UserPlus, tone: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  contact_updated: { icon: Pencil, tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  note_added: { icon: StickyNote, tone: "bg-amber-50 text-amber-600 ring-amber-100" },
  tag_added: { icon: Tag, tone: "bg-violet-50 text-violet-600 ring-violet-100" },
  tag_removed: { icon: Tag, tone: "bg-slate-100 text-slate-500 ring-slate-200" },
  stage_changed: { icon: ArrowRightLeft, tone: "bg-brand-50 text-brand-600 ring-brand-100" },
  opportunity_created: { icon: Target, tone: "bg-brand-50 text-brand-600 ring-brand-100" },
  message_sent: { icon: Send, tone: "bg-sky-50 text-sky-600 ring-sky-100" },
  appointment_booked: { icon: CalendarCheck, tone: "bg-teal-50 text-teal-600 ring-teal-100" },
  appointment_status_changed: { icon: CalendarCheck, tone: "bg-teal-50 text-teal-600 ring-teal-100" },
  task_created: { icon: ListTodo, tone: "bg-orange-50 text-orange-600 ring-orange-100" },
  workflow_action: { icon: Workflow, tone: "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100" },
  campaign: { icon: Megaphone, tone: "bg-pink-50 text-pink-600 ring-pink-100" },
  payment: { icon: CreditCard, tone: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
};

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const { icon: Icon, tone } = ACTIVITY[type] ?? { icon: CircleDot, tone: "bg-slate-100 text-slate-500 ring-slate-200" };
  return (
    <span aria-hidden className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white", tone, className)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
