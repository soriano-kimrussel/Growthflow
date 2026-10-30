import {
  ArrowRightLeft,
  CalendarCheck,
  CalendarClock,
  Clock,
  ListTodo,
  Mail,
  MessageSquare,
  Tag,
  Tags,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";

/** Icon + color per workflow action type, shared by the canvas and lists. */
export const ACTION_STYLE: Record<string, { icon: LucideIcon; tile: string }> = {
  send_email: { icon: Mail, tile: "bg-sky-500 text-white" },
  send_sms: { icon: MessageSquare, tile: "bg-emerald-500 text-white" },
  add_tag: { icon: Tag, tile: "bg-violet-500 text-white" },
  remove_tag: { icon: Tags, tile: "bg-fuchsia-500 text-white" },
  create_task: { icon: ListTodo, tile: "bg-amber-500 text-white" },
  move_opportunity: { icon: ArrowRightLeft, tile: "bg-brand-500 text-white" },
  wait: { icon: Clock, tile: "bg-slate-500 text-white" },
};

export const TRIGGER_ICON: Record<string, LucideIcon> = {
  contact_created: UserPlus,
  contact_tag_added: Tag,
  opportunity_stage_changed: ArrowRightLeft,
  appointment_booked: CalendarCheck,
  appointment_status_changed: CalendarClock,
};

export function ActionGlyph({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const style = ACTION_STYLE[type] ?? ACTION_STYLE.wait;
  const Icon = style.icon;
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-lg shadow-sm", style.tile, size === "sm" ? "h-6 w-6" : "h-9 w-9")}>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
    </span>
  );
}
