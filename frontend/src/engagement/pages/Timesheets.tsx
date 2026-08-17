import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowUpDown, ChevronDown, ChevronUp, Download, X } from "lucide-react";
import { clsx } from "clsx";
import { api, apiErrorMessage } from "../api/client";
import type { AuditGranularity, TimesheetDay, TimesheetMonth, TimesheetStatus, TimesheetSummary } from "../api/types";
import { Card, Loading, ErrorState, PageTitle, StatusBadge, EmptyState } from "../components/ui";
import { fmtMinutes } from "../utils/time";

const STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: "Draft",
  not_started: "Not started",
  submitted: "Submitted",
  approved: "Approved",
  changes_requested: "Changes requested",
};

const RANGE_OPTIONS: Record<AuditGranularity, readonly number[]> = {
  day: [7, 14, 30, 60],
  week: [8, 12, 26, 52],
  month: [3, 6, 12],
};
const DEFAULT_RANGE: Record<AuditGranularity, number> = { day: 14, week: 26, month: 3 };
const RANGE_UNIT_LABEL: Record<AuditGranularity, string> = { day: "days", week: "weeks", month: "months" };
const GRANULARITY_LABEL: Record<AuditGranularity, string> = { day: "Days", week: "Weeks", month: "Months" };

type SortKey = "week_start_date" | "total_minutes" | "billable_minutes" | "submitted_at" | "status";

function cellValue(s: TimesheetSummary, key: SortKey): string | number {
  switch (key) {
    case "week_start_date": return s.week_start_date;
    case "total_minutes": return s.total_minutes;
    case "billable_minutes": return s.billable_minutes;
    case "submitted_at": return s.submitted_at ?? "";
    case "status": return STATUS_LABEL[s.status] ?? s.status;
  }
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadCsv(filename: string, lines: string[][]) {
  const csv = lines.map((line) => line.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function weekLabel(s: { week_start_date: string; week_end_date: string }): string {
  return `${format(parseISO(s.week_start_date), "MMM d")} – ${format(parseISO(s.week_end_date), "MMM d, yyyy")}`;
}

function dayLabel(d: TimesheetDay): string {
  return format(parseISO(d.date), "EEE, MMM d");
}

function submittedLabel(submittedAt: string | null): string {
  return submittedAt ? format(parseISO(submittedAt), "MMM d, HH:mm") : "—";
}

function Th({
  label, sortKey, sort, onSort, align,
}: {
  label: string; sortKey: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; align?: "right";
}) {
  const active = sort.key === sortKey;
  return (
    <th className={clsx("px-5 py-3 font-medium", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={clsx("inline-flex items-center gap-1 hover:text-engagement-ink", align === "right" && "flex-row-reverse")}
      >
        {label}
        {active ? (
          sort.dir === 1 ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}

function GranularityTabs({ value, onChange }: { value: AuditGranularity; onChange: (g: AuditGranularity) => void }) {
  return (
    <div className="flex rounded-md border border-engagement-line bg-white p-0.5">
      {(Object.keys(GRANULARITY_LABEL) as AuditGranularity[]).map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={clsx(
            "rounded px-2.5 py-1 text-sm font-medium transition-colors",
            value === g ? "bg-engagement-accent text-white" : "text-engagement-ink-soft hover:text-engagement-ink",
          )}
        >
          {GRANULARITY_LABEL[g]}
        </button>
      ))}
    </div>
  );
}

function RangeSelect({
  granularity, value, onChange,
}: { granularity: AuditGranularity; value: number; onChange: (n: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 rounded-md border border-engagement-line bg-white px-2 text-sm outline-none focus:border-engagement-accent"
    >
      {RANGE_OPTIONS[granularity].map((n) => (
        <option key={n} value={n}>Last {n} {RANGE_UNIT_LABEL[granularity]}</option>
      ))}
    </select>
  );
}

function Toolbar({
  granularity, onGranularity, rangeCount, onRangeCount,
  status, onStatus, onClear, count, noun, onExport,
}: {
  granularity: AuditGranularity; onGranularity: (g: AuditGranularity) => void;
  rangeCount: number; onRangeCount: (n: number) => void;
  status?: string; onStatus?: (v: string) => void;
  onClear: () => void; count: number; noun: string; onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-engagement-line px-5 py-3">
      <GranularityTabs value={granularity} onChange={onGranularity} />
      <RangeSelect granularity={granularity} value={rangeCount} onChange={onRangeCount} />
      {onStatus && (
        <select
          value={status ?? ""}
          onChange={(e) => onStatus(e.target.value)}
          className="h-9 rounded-md border border-engagement-line bg-white px-2 text-sm outline-none focus:border-engagement-accent"
        >
          <option value="">Status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      )}
      {status && (
        <button
          onClick={onClear}
          className="flex h-9 items-center gap-1 text-sm font-medium text-engagement-accent hover:text-engagement-accent-hover"
        >
          <X className="h-3.5 w-3.5" aria-hidden /> Clear
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-engagement-ink-faint">
          {count} {count === 1 ? noun : `${noun}s`}
        </span>
        <button
          onClick={onExport}
          aria-label="Export CSV"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-engagement-line text-engagement-ink-soft hover:border-engagement-ink-faint hover:text-engagement-ink"
        >
          <Download className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function WeekTable({
  weeks, sort, onSort,
}: { weeks: TimesheetSummary[]; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
          <Th label="Week" sortKey="week_start_date" sort={sort} onSort={onSort} />
          <Th label="Total" sortKey="total_minutes" sort={sort} onSort={onSort} align="right" />
          <Th label="Billable" sortKey="billable_minutes" sort={sort} onSort={onSort} align="right" />
          <Th label="Submitted" sortKey="submitted_at" sort={sort} onSort={onSort} />
          <Th label="Status" sortKey="status" sort={sort} onSort={onSort} align="right" />
        </tr>
      </thead>
      <tbody>
        {weeks.map((s) => (
          <tr key={s.id} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
            <td className="px-5 py-3">
              <Link to={`/engagement/time/entries?date=${s.week_start_date}`} className="font-medium hover:text-engagement-accent">
                {weekLabel(s)}
              </Link>
            </td>
            <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtMinutes(s.total_minutes)}</td>
            <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtMinutes(s.billable_minutes)}</td>
            <td className="px-5 py-3 text-engagement-ink-faint">{submittedLabel(s.submitted_at)}</td>
            <td className="px-5 py-3 text-right">
              <StatusBadge status={s.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayTable({ days }: { days: TimesheetDay[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
          <th className="px-5 py-3 font-medium">Date</th>
          <th className="px-5 py-3 text-right font-medium">Total</th>
          <th className="px-5 py-3 text-right font-medium">Billable</th>
          <th className="px-5 py-3 font-medium">Submitted</th>
          <th className="px-5 py-3 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.date} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
            <td className="px-5 py-3">
              <Link to={`/engagement/time/entries?date=${d.date}`} className="font-medium hover:text-engagement-accent">
                {dayLabel(d)}
              </Link>
              {d.is_today && <span className="ml-2 text-xs text-engagement-accent">today</span>}
            </td>
            <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">
              {d.total_minutes > 0 ? fmtMinutes(d.total_minutes) : "—"}
            </td>
            <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">
              {d.billable_minutes > 0 ? fmtMinutes(d.billable_minutes) : "—"}
            </td>
            <td className="px-5 py-3 text-engagement-ink-faint">{submittedLabel(d.submitted_at)}</td>
            <td className="px-5 py-3 text-right">
              <StatusBadge status={d.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonthTable({ months }: { months: TimesheetMonth[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
          <th className="px-5 py-3 font-medium">Month</th>
          <th className="px-5 py-3 text-right font-medium">Total</th>
          <th className="px-5 py-3 text-right font-medium">Billable</th>
          <th className="px-5 py-3 font-medium">Submitted</th>
          <th className="px-5 py-3 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {months.map((m) => (
          <tr key={m.month} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
            <td className="px-5 py-3">
              <Link to={`/engagement/time/entries?date=${m.month}-01`} className="font-medium hover:text-engagement-accent">
                {m.label}
              </Link>
              {m.is_current && <span className="ml-2 text-xs text-engagement-accent">current</span>}
            </td>
            <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">
              {m.total_minutes > 0 ? fmtMinutes(m.total_minutes) : "—"}
            </td>
            <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">
              {m.billable_minutes > 0 ? fmtMinutes(m.billable_minutes) : "—"}
            </td>
            <td className="px-5 py-3 text-engagement-ink-faint">{submittedLabel(m.submitted_at)}</td>
            <td className="px-5 py-3 text-right text-xs text-engagement-ink-faint">
              {m.weeks_total > 0 ? `${m.weeks_approved}/${m.weeks_total} approved` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Timesheets() {
  const [granularity, setGranularity] = useState<AuditGranularity>("week");
  const [rangeCount, setRangeCount] = useState(DEFAULT_RANGE.week);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "week_start_date", dir: -1 });
  const [data, setData] = useState<TimesheetSummary[] | TimesheetDay[] | TimesheetMonth[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: TimesheetSummary[] | TimesheetDay[] | TimesheetMonth[] }>("/timesheets/my", {
        params: { granularity, count: rangeCount },
      })
      .then((r) => setData(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "Your timesheets could not be loaded")));
  };
  useEffect(load, [granularity, rangeCount]);

  const changeGranularity = (g: AuditGranularity) => {
    setGranularity(g);
    setRangeCount(DEFAULT_RANGE[g]);
    setStatus("");
    setData(null);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading label="Loading timesheets" />;

  if (granularity === "day") {
    const days = data as TimesheetDay[];
    const filtered = status ? days.filter((d) => d.status === status) : days;
    const exportCsv = () =>
      downloadCsv("timesheets-by-day.csv", [
        ["Date", "Total", "Billable", "Submitted", "Status"],
        ...filtered.map((d) => [
          dayLabel(d), fmtMinutes(d.total_minutes), fmtMinutes(d.billable_minutes),
          submittedLabel(d.submitted_at), STATUS_LABEL[d.status] ?? d.status,
        ]),
      ]);
    return (
      <div>
        <PageTitle title="Timesheets" sub="Your weekly submissions and their review status" />
        <Card>
          <Toolbar
            granularity={granularity} onGranularity={changeGranularity}
            rangeCount={rangeCount} onRangeCount={setRangeCount}
            status={status} onStatus={setStatus}
            onClear={() => setStatus("")}
            count={filtered.length} noun="day" onExport={exportCsv}
          />
          {filtered.length === 0 ? (
            <EmptyState title="No days match your filter" hint="Try a different status or a wider range." />
          ) : (
            <DayTable days={filtered} />
          )}
        </Card>
      </div>
    );
  }

  if (granularity === "month") {
    const months = data as TimesheetMonth[];
    return (
      <div>
        <PageTitle title="Timesheets" sub="Your weekly submissions and their review status" />
        <Card>
          <Toolbar
            granularity={granularity} onGranularity={changeGranularity}
            rangeCount={rangeCount} onRangeCount={setRangeCount}
            onClear={() => {}}
            count={months.length} noun="month" onExport={() =>
              downloadCsv("timesheets-by-month.csv", [
                ["Month", "Total", "Billable", "Submitted", "Weeks approved"],
                ...months.map((m) => [
                  m.label, fmtMinutes(m.total_minutes), fmtMinutes(m.billable_minutes),
                  submittedLabel(m.submitted_at), `${m.weeks_approved}/${m.weeks_total}`,
                ]),
              ])
            }
          />
          <MonthTable months={months} />
        </Card>
      </div>
    );
  }

  const weeks = data as TimesheetSummary[];
  const filtered = status ? weeks.filter((s) => s.status === status) : weeks;
  const sorted = [...filtered].sort((a, b) => {
    const av = cellValue(a, sort.key);
    const bv = cellValue(b, sort.key);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return cmp * sort.dir;
  });
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "week_start_date" ? -1 : 1 }));

  const exportCsv = () =>
    downloadCsv("timesheets.csv", [
      ["Week start", "Week end", "Total", "Billable", "Submitted", "Status"],
      ...sorted.map((s) => [
        s.week_start_date, s.week_end_date, fmtMinutes(s.total_minutes), fmtMinutes(s.billable_minutes),
        submittedLabel(s.submitted_at), STATUS_LABEL[s.status] ?? s.status,
      ]),
    ]);

  return (
    <div>
      <PageTitle title="Timesheets" sub="Your weekly submissions and their review status" />
      <Card>
        {weeks.length === 0 ? (
          <>
            <div className="border-b border-engagement-line px-5 py-3">
              <GranularityTabs value={granularity} onChange={changeGranularity} />
            </div>
            <EmptyState title="No timesheets yet" hint="Log time on the Time Entries page to create your first week." />
          </>
        ) : (
          <>
            <Toolbar
              granularity={granularity} onGranularity={changeGranularity}
              rangeCount={rangeCount} onRangeCount={setRangeCount}
              status={status} onStatus={setStatus}
              onClear={() => setStatus("")}
              count={sorted.length} noun="timesheet" onExport={exportCsv}
            />
            {sorted.length === 0 ? (
              <EmptyState title="No timesheets match your filter" hint="Try a different status." />
            ) : (
              <WeekTable weeks={sorted} sort={sort} onSort={toggleSort} />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
