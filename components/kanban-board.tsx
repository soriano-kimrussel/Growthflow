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
import { formatCents } from "@/lib/money";
import { moveOpportunityAction } from "@/modules/opportunities/actions";
import { Badge, cx, statusTone } from "./ui";

export interface BoardCard {
  id: string;
  title: string;
  value: number;
  status: string;
  stageId: string;
  contact: { id: string; name: string };
}

export interface BoardStage {
  id: string;
  name: string;
}

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
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, stageId } : c)));
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const inStage = cards.filter((c) => c.stageId === stage.id);
            return (
              <Column key={stage.id} stage={stage} total={inStage.reduce((sum, c) => sum + c.value, 0)} count={inStage.length}>
                {inStage.map((card) => (
                  <Card key={card.id} card={card} stages={stages} onMove={move} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
    </>
  );
}

function Column({ stage, total, count, children }: { stage: BoardStage; total: number; count: number; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`Stage ${stage.name}`}
      data-stage-id={stage.id}
      className={cx(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-slate-100/70 p-3 transition-colors",
        isOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200",
      )}
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{stage.name}</h3>
        <span className="text-xs text-slate-500">
          {count} · {formatCents(total)}
        </span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
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
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm",
        isDragging ? "z-10 cursor-grabbing shadow-lg ring-2 ring-indigo-400" : "cursor-grab",
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{card.title}</p>
        {card.status !== "open" ? <Badge tone={statusTone(card.status)}>{card.status}</Badge> : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        <Link
          href={`/contacts/${card.contact.id}`}
          className="hover:text-indigo-600 hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {card.contact.name}
        </Link>
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">{formatCents(card.value)}</span>
        <select
          aria-label={`Move ${card.title} to stage`}
          className="max-w-[8rem] rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-600"
          value={card.stageId}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onMove(card.id, e.target.value)}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
