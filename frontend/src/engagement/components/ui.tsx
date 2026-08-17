import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { TimesheetStatus } from "../api/types";

export function Button({
  variant = "primary",
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-engagement-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-engagement-accent text-white hover:bg-engagement-accent-hover",
        variant === "secondary" && "border border-engagement-line bg-white text-engagement-ink hover:border-engagement-ink-faint",
        variant === "ghost" && "text-engagement-ink-soft hover:bg-engagement-line/50",
        variant === "danger" && "bg-engagement-bad text-white hover:bg-red-800",
        className,
      )}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<TimesheetStatus | string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-engagement-line/60 text-engagement-ink-soft" },
  not_started: { label: "Not started", cls: "bg-engagement-bad-soft text-engagement-bad" },
  submitted: { label: "Submitted", cls: "bg-engagement-info-soft text-engagement-info" },
  approved: { label: "Approved", cls: "bg-engagement-ok-soft text-engagement-ok" },
  changes_requested: { label: "Changes requested", cls: "bg-engagement-warn-soft text-engagement-warn" },
  rejected: { label: "Rejected", cls: "bg-engagement-bad-soft text-engagement-bad" },
  active: { label: "Active", cls: "bg-engagement-ok-soft text-engagement-ok" },
  on_hold: { label: "On hold", cls: "bg-engagement-warn-soft text-engagement-warn" },
  completed: { label: "Completed", cls: "bg-engagement-ok-soft text-engagement-ok" },
  pending: { label: "Pending", cls: "bg-engagement-warn-soft text-engagement-warn" },
  cancelled: { label: "Cancelled", cls: "bg-engagement-line/60 text-engagement-ink-faint" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, cls: "bg-engagement-line/60 text-engagement-ink-soft" };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-2xl border border-engagement-line/70 bg-white shadow-sm", className)}>{children}</div>
  );
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-engagement-display text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-engagement-ink-faint">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-16 justify-center text-engagement-ink-faint" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}…
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="font-medium text-engagement-ink-soft">{title}</p>
      {hint && <p className="mt-1 text-engagement-ink-faint">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-14 text-center">
      <p className="font-medium text-engagement-bad">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
