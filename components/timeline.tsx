import { formatDateTime } from "@/lib/time";
import { EmptyState } from "./ui";

const ICONS: Record<string, string> = {
  contact_created: "✦",
  contact_updated: "✎",
  note_added: "✉",
  tag_added: "#",
  tag_removed: "#",
  stage_changed: "→",
  opportunity_created: "$",
  message_sent: "➤",
  appointment_booked: "◷",
  appointment_status_changed: "◷",
  task_created: "✓",
  workflow_action: "⚙",
  campaign: "✺",
  payment: "$",
};

export function Timeline({
  items,
  timeZone,
}: {
  items: { id: string; type: string; title: string; detail: string | null; createdAt: Date }[];
  timeZone: string;
}) {
  if (!items.length) return <EmptyState title="No activity yet" />;
  return (
    <ol aria-label="Activity timeline" className="relative space-y-4 border-l border-slate-200 pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative" data-activity-type={item.type}>
          <span
            aria-hidden
            className="absolute -left-[29px] flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[10px] text-indigo-700"
          >
            {ICONS[item.type] ?? "•"}
          </span>
          <p className="text-sm font-medium text-slate-800">{item.title}</p>
          {item.detail ? <p className="mt-0.5 whitespace-pre-line break-words text-xs text-slate-500">{item.detail}</p> : null}
          <time className="text-xs text-slate-400">{formatDateTime(item.createdAt, timeZone)}</time>
        </li>
      ))}
    </ol>
  );
}
