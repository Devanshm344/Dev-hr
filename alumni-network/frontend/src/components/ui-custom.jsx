"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// color prop values (blue/green/orange/red/purple/slate) are unchanged from
// before this port — every dashboard call site keeps working as-is. `line` is
// new: a real hex value for the sparkline stroke, since Recharts can't consume
// Tailwind classes (same constraint Cotelligent's own theme/charts.js notes).
const colorMap = {
  blue: {
    icon: "bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-950/30 text-blue-600 dark:text-blue-400",
    line: "#2563eb"
  },
  green: {
    icon: "bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/50 dark:to-emerald-950/30 text-emerald-600 dark:text-emerald-400",
    line: "#059669"
  },
  orange: {
    icon: "bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/50 dark:to-orange-950/30 text-orange-600 dark:text-orange-400",
    line: "#ea580c"
  },
  red: {
    icon: "bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/50 dark:to-red-950/30 text-red-600 dark:text-red-400",
    line: "#dc2626"
  },
  purple: {
    icon: "bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/50 dark:to-violet-950/30 text-violet-600 dark:text-violet-400",
    line: "#7c3aed"
  },
  slate: {
    icon: "bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 text-slate-600 dark:text-slate-400",
    line: "#475569"
  }
};

// Matches Cotelligent's KpiCard.jsx useCountUp exactly — same easing, same
// duration. Only engages for a real number; StatCard still accepts a
// preformatted string (most call sites pass String(count)) and just renders
// it statically, same as before this port.
function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (typeof target !== "number") return;
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(start + diff * e));
      if (p < 1) requestAnimationFrame(tick);else prev.current = target;
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}
const CARD_CLS = "bg-card rounded-xl border border-border p-3.5 shadow-sm";
const ICON_BOX_CLS = "w-11 h-11 sm:w-12 sm:h-12 rounded-xl";
const SPARKLINE_CLS = "h-7 mt-2";
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
  sparkline = [],
  className,
  style
}) {
  const gradientId = useId();
  const colors = colorMap[color];
  // A numeric value (not yet formatted to a string by the caller) gets the
  // same count-up animation Cotelligent's KpiCard uses; a preformatted
  // string (the common case in this app today) renders as-is.
  const isNumeric = typeof value === "number";
  const displayed = useCountUp(isNumeric ? value : null);
  const chartData = (sparkline || []).map((v, i) => ({
    i,
    v
  }));
  const hasSparkline = chartData.length > 1;
  return <div style={style} className={cn(CARD_CLS, "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 animate-fade-up", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-black text-foreground tabular-nums leading-none mt-1.5">
            {isNumeric ? displayed.toLocaleString() : (value ?? "—")}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1.5 truncate">{subtitle}</p>}
          {trend && <div className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full mt-1.5", trend.value > 0 ? "text-emerald-700 bg-emerald-50" : trend.value < 0 ? "text-red-700 bg-red-50" : "text-muted-foreground bg-secondary")}>
              {trend.value > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : trend.value < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
              <span>{trend.value > 0 ? "+" : ""}{trend.value}% {trend.label}</span>
            </div>}
        </div>
        <div className={cn(ICON_BOX_CLS, "flex items-center justify-center shrink-0 ml-4", colors.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className={cn(SPARKLINE_CLS, "-mx-1")}>
        {hasSparkline ? <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{
          top: 2,
          right: 0,
          bottom: 0,
          left: 0
        }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.line} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={colors.line} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer> : null}
      </div>
    </div>;
}
export function StatCardSkeleton({ className }) {
  return <div className={cn(CARD_CLS, "animate-pulse")} aria-busy="true" aria-label="Loading metric">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 space-y-2.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className={cn(ICON_BOX_CLS, "shrink-0 ml-4")} />
      </div>
      <Skeleton className={cn(SPARKLINE_CLS, "w-full")} />
    </div>;
}
export function ChartSkeleton({ height = 200, className }) {
  return <Skeleton className={cn("w-full rounded-lg", className)} style={{ height }} />;
}
export function RowSkeleton({ className }) {
  return <div className={cn("flex items-center gap-3", className)}>
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>;
}
const statusConfig = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
  },
  inactive: {
    label: "Inactive",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
  },
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
  },
  suspended: {
    label: "Suspended",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
  },
  completed: {
    label: "Completed",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
  },
  "under-review": {
    label: "Under Review",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
  },
  past: {
    label: "Past",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
  },
  high: {
    label: "High",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
  },
  medium: {
    label: "Medium",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
  },
  low: {
    label: "Low",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
  },
  success: {
    label: "Success",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
  }
};
export function StatusBadge({
  status,
  className
}) {
  const config = statusConfig[status.toLowerCase()] ?? {
    label: status,
    className: "bg-secondary text-secondary-foreground"
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className, className)}>
      {config.label}
    </span>;
}
export function DashboardHero({
  title,
  subtitle,
  children
}) {
  return <div className="td-gradient hero-glow rounded-xl px-6 py-5 mb-6 shadow-lg shadow-primary/25">
      <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-white/80 mt-1">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      </div>
    </div>;
}
export function PageHeader({
  title,
  description,
  children,
  breadcrumbs
}) {
  return <div className="mb-6">
      {breadcrumbs && <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((b, i) => <span key={i} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"}>
                {b.label}
              </span>
            </span>)}
        </nav>}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      </div>
    </div>;
}
export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}) {
  return <div className="flex flex-col items-center justify-center py-16 text-center fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>;
}
export function LoadingSkeleton({
  rows = 5
}) {
  return <div className="space-y-3 animate-pulse">
      {Array.from({
      length: rows
    }).map((_, i) => <div key={i} className="h-12 bg-secondary rounded-lg" style={{
      opacity: 1 - i * 0.1
    }} />)}
    </div>;
}
