"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Clock, GripVertical } from "lucide-react";
import { formatCents } from "@/lib/money";
import { moveOpportunityAction } from "@/modules/opportunities/actions";
import { Avatar, Badge, cx, statusTone } from "./ui";

export interface BoardCard {
  id: string;
  title: string;
  value: number;
  status: string;
  stageId: string;
  /** Whole days since the deal last changed, computed on the server. */
  ageDays: number;
  contact: { id: string; name: string };
}

export interface BoardStage {
  id: string;
  name: string;
}

// Stage accents in a fixed order, so a stage keeps its color as cards move.
const STAGE_ACCENTS = [
  { bar: "bg-sky-500", dot: "bg-sky-500" },
  { bar: "bg-violet-500", dot: "bg-violet-500" },
  { bar: "bg-amber-500", dot: "bg-amber-500" },
  { bar: "bg-emerald-500", dot: "bg-emerald-500" },
  { bar: "bg-rose-500", dot: "bg-rose-500" },
  { bar: "bg-teal-500", dot: "bg-teal-500" },
  { bar: "bg-orange-500", dot: "bg-orange-500" },
  { bar: "bg-indigo-500", dot: "bg-indigo-500" },
];

export function KanbanBoard({ stages, cards: initial }: { stages: BoardStage[]; cards: BoardCard[] }) {
  const [cards, setCards] = useState(initial);
  const [serverCards, setServerCards] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Stable id keeps dnd-kit's generated aria ids identical on server and client.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Fresh server data (after the action revalidates the page) replaces local state.
  if (initial !== serverCards) {
    setServerCards(initial);
    setCards(initial);
  }

  function move(cardId: string, stageId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.stageId === stageId) return;
    const previous = cards;
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, stageId, ageDays: 0 } : c)));
    setError(null);
    startTransition(async () => {
      const result = await moveOpportunityAction(cardId, stageId);
      if (result.error) {
        setCards(previous);
        setError(result.error);
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    if (event.over) move(String(event.active.id), String(event.over.id));
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="scroll-thin -mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
          {stages.map((stage, index) => {
            const inStage = cards.filter((c) => c.stageId === stage.id);
            return (
              <Column
                key={stage.id}
                stage={stage}
                accent={STAGE_ACCENTS[index % STAGE_ACCENTS.length]}
                total={inStage.reduce((sum, c) => sum + c.value, 0)}
                count={inStage.length}
              >
                {inStage.length ? (
                  inStage.map((card) => <Card key={card.id} card={card} stages={stages} onMove={move} />)
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">Drop deals here</p>
                )}
              </Column>
            );
          })}
        </div>
      </DndContext>
    </>
  );
}

function Column({
  stage,
  accent,
  total,
  count,
  children,
}: {
  stage: BoardStage;
  accent: (typeof STAGE_ACCENTS)[number];
  total: number;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`Stage ${stage.name}`}
      data-stage-id={stage.id}
      className={cx(
        "flex min-w-[16rem] flex-1 flex-col overflow-hidden rounded-2xl border bg-slate-100/60 transition-colors",
        isOver ? "border-brand-300 bg-brand-50/70 ring-4 ring-brand-500/10" : "border-line",
      )}
    >
      <div className={cx("h-1", accent.bar)} />
      <header className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx("h-2 w-2 shrink-0 rounded-full", accent.dot)} />
          <h3 className="truncate text-sm font-semibold text-slate-800">{stage.name}</h3>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-line">{count}</span>
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-600">{formatCents(total)}</span>
      </header>
      <div className="flex min-h-28 flex-1 flex-col gap-2 px-2.5 pb-3">{children}</div>
    </section>
  );
}

function Card({ card, stages, onMove }: { card: BoardCard; stages: BoardStage[]; onMove: (id: string, stageId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <article
      ref={setNodeRef}
      style={style}
      data-testid={`opportunity-${card.id}`}
      aria-label={`Opportunity ${card.title}`}
      className={cx(
        "group rounded-xl border border-line bg-white p-3 shadow-card transition-shadow hover:shadow-pop",
        isDragging ? "relative z-10 cursor-grabbing rotate-1 shadow-pop ring-2 ring-brand-400" : "cursor-grab",
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-900">{card.title}</p>
        <GripVertical aria-hidden className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Avatar name={card.contact.name} size="xs" />
        <Link
          href={`/contacts/${card.contact.id}`}
          className="truncate text-xs text-slate-600 hover:text-brand-700 hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {card.contact.name}
        </Link>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <span className="text-sm font-semibold tabular-nums text-slate-900">{formatCents(card.value)}</span>
        <div className="flex items-center gap-2">
          {card.status !== "open" ? <Badge tone={statusTone(card.status)}>{card.status}</Badge> : null}
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" title="Days since last change">
            <Clock className="h-3 w-3" />
            {card.ageDays}d
          </span>
        </div>
      </div>
      <select
        aria-label={`Move ${card.title} to stage`}
        className="mt-2 w-full rounded-md border border-line bg-slate-50 px-1.5 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        value={card.stageId}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => onMove(card.id, e.target.value)}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            Move to: {s.name}
          </option>
        ))}
      </select>
    </article>
  );
}
