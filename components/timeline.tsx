import { Activity } from "lucide-react";
import { formatDateTime } from "@/lib/time";
import { ActivityIcon } from "./activity-icon";
import { EmptyState } from "./ui";

export function Timeline({
  items,
  timeZone,
}: {
  items: { id: string; type: string; title: string; detail: string | null; createdAt: Date }[];
  timeZone: string;
}) {
  if (!items.length) return <EmptyState title="No activity yet" icon={Activity} />;
  return (
    <ol aria-label="Activity timeline" className="relative">
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0" data-activity-type={item.type}>
          {i < items.length - 1 ? <span aria-hidden className="absolute left-[13px] top-7 h-full w-px bg-line" /> : null}
          <ActivityIcon type={item.type} />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium leading-5 text-slate-800">{item.title}</p>
            {item.detail ? (
              <p className="mt-1 whitespace-pre-line break-words rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-600">{item.detail}</p>
            ) : null}
            <time className="mt-1 block text-[11px] text-slate-400">{formatDateTime(item.createdAt, timeZone)}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
