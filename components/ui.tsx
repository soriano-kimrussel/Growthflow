import Link from "next/link";
import type { ComponentProps, ComponentType, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

// ---------------------------------------------------------------------------
// Color helpers: stable, name-derived colors for avatars and tags.
// ---------------------------------------------------------------------------

const SWATCHES = [
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-amber-100 text-amber-800 ring-amber-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-sky-100 text-sky-700 ring-sky-200",
  "bg-violet-100 text-violet-700 ring-violet-200",
  "bg-pink-100 text-pink-700 ring-pink-200",
  "bg-teal-100 text-teal-700 ring-teal-200",
  "bg-orange-100 text-orange-700 ring-orange-200",
  "bg-indigo-100 text-indigo-700 ring-indigo-200",
  "bg-lime-100 text-lime-800 ring-lime-200",
];

export function swatch(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SWATCHES[hash % SWATCHES.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function contactName(c: { firstName: string; lastName: string }) {
  return `${c.firstName} ${c.lastName}`.trim();
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <div className="mt-1 text-sm text-slate-500">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: IconType;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-2xl border border-line bg-white shadow-card", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
              {description ? <p className="truncate text-xs text-slate-500">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx("p-5", Boolean(title) && "pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const buttonStyles = {
  primary: "bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:bg-brand-300",
  secondary: "border border-line bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-400",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};
export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed",
    size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
    buttonStyles[variant],
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

const fieldClass =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldClass, "pr-8", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges, tags, avatars
// ---------------------------------------------------------------------------

const badgeTones = {
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  indigo: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
};
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "slate", children, dot = false }: { tone?: BadgeTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset", badgeTones[tone])}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
    case "won":
    case "showed":
    case "completed":
    case "sent":
    case "succeeded":
      return "green";
    case "booked":
    case "open":
      return "blue";
    case "paused":
    case "draft":
    case "waiting":
      return "amber";
    case "failed":
    case "lost":
    case "no_show":
    case "cancelled":
    case "stopped":
      return "red";
    default:
      return "slate";
  }
}

/** A colored tag chip; the color is derived from the tag name. */
export function TagChip({ name }: { name: string }) {
  return <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", swatch(name))}>{name}</span>;
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { xs: "h-5 w-5 text-[9px]", sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm", xl: "h-16 w-16 text-lg" };
  return (
    <span aria-hidden className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset", swatch(name), sizes[size], className)}>
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

const tileTones = {
  brand: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
};
export type TileTone = keyof typeof tileTones;

export function IconTile({ icon: Icon, tone = "brand", size = "md" }: { icon: IconType; tone?: TileTone; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : size === "lg" ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-xl";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center", box, tileTones[tone])}>
      <Icon className={glyph} />
    </span>
  );
}

export function StatCard({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon: IconType; tone?: TileTone }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <IconTile icon={icon} tone={tone} />
      </div>
      <p className="mt-2 truncate text-2xl font-semibold leading-none tracking-tight text-slate-900 sm:text-[1.75rem]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Progress({ value, className, tone = "bg-brand-500" }: { value: number; className?: string; tone?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon }: { title: string; children?: ReactNode; icon?: IconType }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
      {Icon ? <IconTile icon={Icon} tone="slate" /> : null}
      <p className={cx("text-sm font-medium text-slate-700", Icon && "mt-3")}>{title}</p>
      {children ? <div className="mt-1 text-sm text-slate-500">{children}</div> : null}
    </div>
  );
}

/** Pill-style link tabs (filters, channel switches, pipeline switcher). */
export function PillTabs({ items, label }: { items: { href: string; label: ReactNode; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1 shadow-card">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cx(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            t.active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
