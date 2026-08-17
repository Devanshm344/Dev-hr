import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Download, Search, X } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { AuditDay, AuditGranularity, AuditMonth, AuditWeek, TeamAuditRow, TimesheetStatus } from "../api/types";
import { useEngagementUser } from "../api/context";
import { Card, Loading, ErrorState, PageTitle, StatusBadge, EmptyState } from "../components/ui";
import { fmtMinutes } from "../utils/time";
import { clsx } from "clsx";

const RANGE_OPTIONS: Record<AuditGranularity, readonly number[]> = {
  day: [7, 14, 30, 60],
  week: [4, 8, 12, 26],
  month: [3, 6, 12],
};
const DEFAULT_RANGE: Record<AuditGranularity, number> = { day: 14, week: 8, month: 3 };
const RANGE_UNIT_LABEL: Record<AuditGranularity, string> = { day: "days", week: "weeks", month: "months" };
const GRANULARITY_LABEL: Record<AuditGranularity, string> = { day: "Days", week: "Weeks", month: "Months" };

const STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: "Draft",
  not_started: "Not started",
  submitted: "Submitted",
  approved: "Approved",
  changes_requested: "Changes requested",
};

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

function weekLabel(w: AuditWeek): string {
  return `${format(parseISO(w.week_start_date), "MMM d")} – ${format(parseISO(w.week_end_date), "MMM d")}`;
}

function dayLabel(d: AuditDay): string {
  return format(parseISO(d.date), "EEE, MMM d");
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

function StatusFilterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-engagement-line bg-white px-2 text-sm outline-none focus:border-engagement-accent"
    >
      <option value="">Status</option>
      {Object.entries(STATUS_LABEL).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function WeeksTable({ weeks }: { weeks: AuditWeek[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
          <th className="px-5 py-3 font-medium">Week</th>
          <th className="px-5 py-3 font-medium">Progress</th>
          <th className="px-5 py-3 text-right font-medium">Logged</th>
          <th className="px-5 py-3 text-right font-medium">Missing</th>
          <th className="px-5 py-3 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => {
          const pct = Math.min((w.logged_minutes / w.capacity_minutes) * 100, 100);
          return (
            <tr key={w.week_start_date} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
              <td className="px-5 py-3">
                <Link to={`/engagement/time/entries?date=${w.week_start_date}`} className="font-medium hover:text-engagement-accent">
                  {weekLabel(w)}
                </Link>
                {w.is_current && <span className="ml-2 text-xs text-engagement-accent">current</span>}
              </td>
              <td className="w-56 px-5 py-3">
                <div className="h-1.5 rounded-full bg-engagement-line">
                  <div
                    className={`h-1.5 rounded-full ${w.missing_minutes === 0 ? "bg-engagement-ok" : pct > 0 ? "bg-engagement-accent" : "bg-engagement-bad"}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </td>
              <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtMinutes(w.logged_minutes)}</td>
              <td className={`px-5 py-3 text-right font-engagement-mono tabular-nums ${w.missing_minutes > 0 ? "text-engagement-bad" : "text-engagement-ink-faint"}`}>
                {w.missing_minutes > 0 ? fmtMinutes(w.missing_minutes) : "—"}
              </td>
              <td className="px-5 py-3 text-right">
                <span className="inline-flex items-center gap-1.5">
                  {w.reminder_stage === "overdue" && (
                    <span className="rounded-full bg-engagement-warn-soft px-2 py-0.5 text-xs font-medium text-engagement-warn">
                      Overdue
                    </span>
                  )}
                  {w.reminder_stage === "escalated" && (
                    <span className="rounded-full bg-engagement-bad-soft px-2 py-0.5 text-xs font-medium text-engagement-bad">
                      Escalated
                    </span>
                  )}
                  <StatusBadge status={w.status} />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DaysTable({ days }: { days: AuditDay[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
          <th className="px-5 py-3 font-medium">Date</th>
          <th className="px-5 py-3 font-medium">Progress</th>
          <th className="px-5 py-3 text-right font-medium">Logged</th>
          <th className="px-5 py-3 text-right font-medium">Missing</th>
          <th className="px-5 py-3 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => {
          const pct = d.capacity_minutes > 0 ? Math.min((d.logged_minutes / d.capacity_minutes) * 100, 100) : 0;
          return (
            <tr key={d.date} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
              <td className="px-5 py-3">
                <Link to={`/engagement/time/entries?date=${d.date}`} className="font-medium hover:text-engagement-accent">
                  {dayLabel(d)}
                </Link>
                {d.is_today && <span className="ml-2 text-xs text-engagement-accent">today</span>}
                {!d.is_working_day && <span className="ml-2 text-xs text-engagement-ink-faint">non-working</span>}
              </td>
              <td className="w-56 px-5 py-3">
                {d.capacity_minutes > 0 ? (
                  <div className="h-1.5 rounded-full bg-engagement-line">
                    <div
                      className={`h-1.5 rounded-full ${d.missing_minutes === 0 ? "bg-engagement-ok" : pct > 0 ? "bg-engagement-accent" : "bg-engagement-bad"}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-engagement-ink-faint">—</span>
                )}
              </td>
              <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">
                {d.logged_minutes > 0 ? fmtMinutes(d.logged_minutes) : "—"}
              </td>
              <td className={`px-5 py-3 text-right font-engagement-mono tabular-nums ${d.missing_minutes > 0 ? "text-engagement-bad" : "text-engagement-ink-faint"}`}>
                {d.missing_minutes > 0 ? fmtMinutes(d.missing_minutes) : "—"}
              </td>
              <td className="px-5 py-3 text-right">
                <StatusBadge status={d.status} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MonthsTable({ months }: { months: AuditMonth[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
          <th className="px-5 py-3 font-medium">Month</th>
          <th className="px-5 py-3 font-medium">Progress</th>
          <th className="px-5 py-3 text-right font-medium">Logged</th>
          <th className="px-5 py-3 text-right font-medium">Missing</th>
          <th className="px-5 py-3 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {months.map((m) => {
          const pct = m.capacity_minutes > 0 ? Math.min((m.logged_minutes / m.capacity_minutes) * 100, 100) : 0;
          return (
            <tr key={m.month} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
              <td className="px-5 py-3">
                <Link to={`/engagement/time/entries?date=${m.month}-01`} className="font-medium hover:text-engagement-accent">
                  {m.label}
                </Link>
                {m.is_current && <span className="ml-2 text-xs text-engagement-accent">current</span>}
              </td>
              <td className="w-56 px-5 py-3">
                <div className="h-1.5 rounded-full bg-engagement-line">
                  <div
                    className={`h-1.5 rounded-full ${m.missing_minutes === 0 ? "bg-engagement-ok" : pct > 0 ? "bg-engagement-accent" : "bg-engagement-bad"}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </td>
              <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtMinutes(m.logged_minutes)}</td>
              <td className={`px-5 py-3 text-right font-engagement-mono tabular-nums ${m.missing_minutes > 0 ? "text-engagement-bad" : "text-engagement-ink-faint"}`}>
                {m.missing_minutes > 0 ? fmtMinutes(m.missing_minutes) : "—"}
              </td>
              <td className="px-5 py-3 text-right">
                <span className="inline-flex items-center gap-1.5">
                  {m.reminder_stage === "overdue" && (
                    <span className="rounded-full bg-engagement-warn-soft px-2 py-0.5 text-xs font-medium text-engagement-warn">
                      Overdue
                    </span>
                  )}
                  {m.reminder_stage === "escalated" && (
                    <span className="rounded-full bg-engagement-bad-soft px-2 py-0.5 text-xs font-medium text-engagement-bad">
                      Escalated
                    </span>
                  )}
                  <span className="text-xs text-engagement-ink-faint">
                    {m.weeks_approved}/{m.weeks_total} approved
                  </span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Toolbar({
  granularity, onGranularity, rangeCount, onRangeCount,
  status, onStatus, memberSearch, onMemberSearch, onClear, count, noun, onExport,
}: {
  granularity: AuditGranularity; onGranularity: (g: AuditGranularity) => void;
  rangeCount: number; onRangeCount: (n: number) => void;
  status?: string; onStatus?: (v: string) => void;
  memberSearch?: string; onMemberSearch?: (v: string) => void;
  onClear: () => void; count: number; noun: string; onExport: () => void;
}) {
  const filtersActive = !!status || !!memberSearch;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-engagement-line px-4 py-3">
      {onMemberSearch !== undefined && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-engagement-ink-faint" aria-hidden />
          <input
            value={memberSearch}
            onChange={(e) => onMemberSearch(e.target.value)}
            placeholder="Search member…"
            className="h-9 w-48 rounded-md border border-engagement-line pl-8 pr-2 text-sm outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
          />
        </div>
      )}
      <GranularityTabs value={granularity} onChange={onGranularity} />
      <RangeSelect granularity={granularity} value={rangeCount} onChange={onRangeCount} />
      {onStatus && <StatusFilterSelect value={status ?? ""} onChange={onStatus} />}
      {filtersActive && (
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

function MyPeriods() {
  const [granularity, setGranularity] = useState<AuditGranularity>("week");
  const [rangeCount, setRangeCount] = useState(DEFAULT_RANGE.week);
  const [status, setStatus] = useState("");
  const [data, setData] = useState<AuditDay[] | AuditWeek[] | AuditMonth[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: AuditDay[] | AuditWeek[] | AuditMonth[] }>("/time/auditing", { params: { granularity, count: rangeCount } })
      .then((r) => setData(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "Auditing data could not be loaded")));
  };
  useEffect(load, [granularity, rangeCount]);

  const changeGranularity = (g: AuditGranularity) => {
    setGranularity(g);
    setRangeCount(DEFAULT_RANGE[g]);
    setStatus("");
    setData(null);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading label="Checking your weeks" />;

  if (granularity === "day") {
    const days = data as AuditDay[];
    const filtered = status ? days.filter((d) => d.status === status) : days;
    const workingDays = days.filter((d) => d.is_working_day);
    const complete = workingDays.filter((d) => d.missing_minutes === 0).length;
    const exportCsv = () =>
      downloadCsv("my-days-audit.csv", [
        ["Date", "Logged", "Missing", "Status"],
        ...filtered.map((d) => [dayLabel(d), fmtMinutes(d.logged_minutes), fmtMinutes(d.missing_minutes), STATUS_LABEL[d.status]]),
      ]);
    return (
      <div>
        <p className="mb-3 text-engagement-ink-faint">
          Last {days.length} days · {complete} of {workingDays.length} working days at full capacity
        </p>
        <Card>
          <Toolbar
            granularity={granularity} onGranularity={changeGranularity}
            rangeCount={rangeCount} onRangeCount={setRangeCount}
            status={status} onStatus={setStatus}
            onClear={() => setStatus("")}
            count={filtered.length} noun="day" onExport={exportCsv}
          />
          {filtered.length === 0 ? (
            <EmptyState title="No days match your filters" hint="Try a different status or a wider range." />
          ) : (
            <DaysTable days={filtered} />
          )}
        </Card>
      </div>
    );
  }

  if (granularity === "month") {
    const months = data as AuditMonth[];
    const complete = months.filter((m) => m.weeks_total > 0 && m.weeks_approved === m.weeks_total).length;
    const exportCsv = () =>
      downloadCsv("my-months-audit.csv", [
        ["Month", "Logged", "Missing", "Weeks approved"],
        ...months.map((m) => [m.label, fmtMinutes(m.logged_minutes), fmtMinutes(m.missing_minutes), `${m.weeks_approved}/${m.weeks_total}`]),
      ]);
    return (
      <div>
        <p className="mb-3 text-engagement-ink-faint">
          Last {months.length} months · {complete} of {months.length} fully approved
        </p>
        <Card>
          <Toolbar
            granularity={granularity} onGranularity={changeGranularity}
            rangeCount={rangeCount} onRangeCount={setRangeCount}
            onClear={() => {}}
            count={months.length} noun="month" onExport={exportCsv}
          />
          <MonthsTable months={months} />
        </Card>
      </div>
    );
  }

  const weeks = data as AuditWeek[];
  const filtered = status ? weeks.filter((w) => w.status === status) : weeks;
  const complete = weeks.filter((w) => w.missing_minutes === 0 || w.status === "approved").length;
  const exportCsv = () =>
    downloadCsv("my-weeks-audit.csv", [
      ["Week", "Logged", "Missing", "Status"],
      ...filtered.map((w) => [weekLabel(w), fmtMinutes(w.logged_minutes), fmtMinutes(w.missing_minutes), STATUS_LABEL[w.status ?? "draft"]]),
    ]);

  return (
    <div>
      <p className="mb-3 text-engagement-ink-faint">
        Last {weeks.length} weeks · {complete} of {weeks.length} at full capacity
      </p>
      <Card>
        <Toolbar
          granularity={granularity} onGranularity={changeGranularity}
          rangeCount={rangeCount} onRangeCount={setRangeCount}
          status={status} onStatus={setStatus}
          onClear={() => setStatus("")}
          count={filtered.length} noun="week" onExport={exportCsv}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No weeks match your filters" hint="Try a different status or a wider range." />
        ) : (
          <WeeksTable weeks={filtered} />
        )}
      </Card>
      <p className="mt-3 text-xs text-engagement-ink-faint">
        Weeks are measured against your capacity of{" "}
        <span className="font-engagement-mono tabular-nums">{fmtMinutes(weeks[0]?.capacity_minutes ?? 2400)}</span> per week.
      </p>
    </div>
  );
}

function TeamPeriods() {
  const [granularity, setGranularity] = useState<AuditGranularity>("week");
  const [rangeCount, setRangeCount] = useState(DEFAULT_RANGE.week);
  const [status, setStatus] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [rows, setRows] = useState<TeamAuditRow<AuditDay | AuditWeek | AuditMonth>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: TeamAuditRow<AuditDay | AuditWeek | AuditMonth>[] }>("/approvals/team-auditing", { params: { granularity, count: rangeCount } })
      .then((r) => setRows(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "Team auditing data could not be loaded")));
  };
  useEffect(load, [granularity, rangeCount]);

  const changeGranularity = (g: AuditGranularity) => {
    setGranularity(g);
    setRangeCount(DEFAULT_RANGE[g]);
    setStatus("");
    setRows(null);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <Loading label="Checking your team" />;
  if (rows.length === 0) {
    return <p className="py-14 text-center text-engagement-ink-faint">No direct reports.</p>;
  }

  const q = memberSearch.trim().toLowerCase();
  const filtered = rows
    .filter((r) => !q || `${r.user.name} ${r.user.employee_code} ${r.user.job_title ?? ""}`.toLowerCase().includes(q))
    .map((r) => ({
      ...r,
      periods:
        status && granularity !== "month"
          ? (r.periods as (AuditDay | AuditWeek)[]).filter((p) => p.status === status)
          : r.periods,
    }))
    .filter((r) => r.periods.length > 0);

  const totalPeriods = filtered.reduce((sum, r) => sum + r.periods.length, 0);
  const noun = granularity === "day" ? "day" : granularity === "month" ? "month" : "week";

  const exportCsv = () => {
    if (granularity === "day") {
      downloadCsv("team-days-audit.csv", [
        ["Member", "Date", "Logged", "Missing", "Status"],
        ...filtered.flatMap((r) =>
          (r.periods as AuditDay[]).map((d) => [r.user.name, dayLabel(d), fmtMinutes(d.logged_minutes), fmtMinutes(d.missing_minutes), STATUS_LABEL[d.status]]),
        ),
      ]);
    } else if (granularity === "month") {
      downloadCsv("team-months-audit.csv", [
        ["Member", "Month", "Logged", "Missing", "Weeks approved"],
        ...filtered.flatMap((r) =>
          (r.periods as AuditMonth[]).map((m) => [r.user.name, m.label, fmtMinutes(m.logged_minutes), fmtMinutes(m.missing_minutes), `${m.weeks_approved}/${m.weeks_total}`]),
        ),
      ]);
    } else {
      downloadCsv("team-audit.csv", [
        ["Member", "Week", "Logged", "Missing", "Status"],
        ...filtered.flatMap((r) =>
          (r.periods as AuditWeek[]).map((w) => [r.user.name, weekLabel(w), fmtMinutes(w.logged_minutes), fmtMinutes(w.missing_minutes), STATUS_LABEL[w.status ?? "draft"]]),
        ),
      ]);
    }
  };

  return (
    <div>
      <Card>
        <Toolbar
          granularity={granularity} onGranularity={changeGranularity}
          rangeCount={rangeCount} onRangeCount={setRangeCount}
          status={granularity === "month" ? undefined : status}
          onStatus={granularity === "month" ? undefined : setStatus}
          memberSearch={memberSearch}
          onMemberSearch={setMemberSearch}
          onClear={() => {
            setStatus("");
            setMemberSearch("");
          }}
          count={totalPeriods} noun={noun} onExport={exportCsv}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No results match your filters" hint="Try a different status, member, or a wider range." />
        ) : (
          <div className="divide-y divide-engagement-line">
            {filtered.map((r) => (
              <div key={r.user.id} className="px-5 py-4">
                <h2 className="mb-2 font-medium">
                  {r.user.name} <span className="font-normal text-engagement-ink-faint">· {r.user.job_title ?? r.user.employee_code}</span>
                </h2>
                <div className="-mx-5">
                  {granularity === "day" && <DaysTable days={r.periods as AuditDay[]} />}
                  {granularity === "week" && <WeeksTable weeks={r.periods as AuditWeek[]} />}
                  {granularity === "month" && <MonthsTable months={r.periods as AuditMonth[]} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Auditing() {
  const user = useEngagementUser();
  const canSeeTeam = user.role === "manager" || user.role === "admin";
  const [tab, setTab] = useState<"mine" | "team">("mine");

  return (
    <div>
      <PageTitle
        title="Auditing"
        sub="Weekly capacity compliance"
        actions={
          canSeeTeam && (
            <div className="flex rounded-md border border-engagement-line bg-white p-0.5">
              <button
                onClick={() => setTab("mine")}
                className={clsx(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === "mine" ? "bg-engagement-accent text-white" : "text-engagement-ink-soft hover:text-engagement-ink",
                )}
              >
                My weeks
              </button>
              <button
                onClick={() => setTab("team")}
                className={clsx(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === "team" ? "bg-engagement-accent text-white" : "text-engagement-ink-soft hover:text-engagement-ink",
                )}
              >
                My team
              </button>
            </div>
          )
        }
      />
      {tab === "mine" || !canSeeTeam ? <MyPeriods /> : <TeamPeriods />}
    </div>
  );
}
