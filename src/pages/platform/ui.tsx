import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/* Shared building blocks for the platform (super-admin) console, so every
   page shares one header, stat card, status badge and empty-state style. */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-smoke">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-smoke">{label}</p>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            accent ? "bg-brand/10 text-brand" : "bg-cloud text-smoke"
          }`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-smoke">{hint}</p>}
    </div>
  );
}

type Tone = "green" | "red" | "amber" | "neutral";

const TONES: Record<Tone, string> = {
  green: "bg-live/10 text-live",
  red: "bg-alert/10 text-alert",
  amber: "bg-amber/15 text-ink",
  neutral: "bg-mist/60 text-smoke",
};

const DOTS: Record<Tone, string> = {
  green: "bg-live",
  red: "bg-alert",
  amber: "bg-amber",
  neutral: "bg-smoke/50",
};

const STATUS_TONE: Record<string, Tone> = {
  active: "green",
  trialing: "amber",
  trial: "amber",
  suspended: "red",
  past_due: "amber",
  canceled: "neutral",
  cancelled: "neutral",
  none: "neutral",
  incomplete: "amber",
  sent: "green",
  sending: "amber",
  draft: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  past_due: "Past due",
  none: "No subscription",
};

/** Consistent pill for account/subscription status across every page. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "none").toLowerCase();
  const tone = STATUS_TONE[key] ?? "neutral";
  const label = STATUS_LABEL[key] ?? (status ?? "none");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${TONES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} />
      {label}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Icon size={30} className="text-smoke/50" />
      <p className="mt-3 font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-smoke">{hint}</p>}
    </div>
  );
}
