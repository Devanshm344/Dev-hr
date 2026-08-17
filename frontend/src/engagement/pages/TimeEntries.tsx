import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { WeekGrid, GridRow, Utilization } from "../api/types";
import { AddRowModal, type NewRow } from "../components/AddRowModal";
import { WeekendReasonModal } from "../components/WeekendReasonModal";
import { Button, Card, Loading, ErrorState, StatusBadge, EmptyState } from "../components/ui";
import { fmtMinutes, parseToMinutes } from "../utils/time";

type PendingRow = NewRow;
type JumpUnit = "week" | "month";

const rowKey = (r: { project_id: string; task_id: string | null }) =>
  `${r.project_id}|${r.task_id ?? ""}`;

const JUMP_UNIT_LABEL: Record<JumpUnit, string> = { week: "Week", month: "Month" };

/** Every Monday-start week whose range touches the calendar month `anyDateInMonth` falls in. */
function weeksInMonth(anyDateInMonth: string): string[] {
  const monthStart = startOfMonth(parseISO(anyDateInMonth));
  const monthEnd = endOfMonth(monthStart);
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(monthEnd, { weekStartsOn: 1 });
  const weeks: string[] = [];
  for (let cur = firstWeekStart; cur <= lastWeekStart; cur = addWeeks(cur, 1)) {
    weeks.push(format(cur, "yyyy-MM-dd"));
  }
  return weeks;
}

/** Month view: a real calendar (weeks as rows, days as columns) instead of every
 * week's full editable grid stacked one after another. Each week's day totals and
 * status come from the same /time/week endpoint the week editor uses, fetched
 * read-only (create: false) so just browsing a month never creates draft
 * timesheets for weeks nobody has touched. Clicking a week hands its start date
 * back to the caller, which switches into week view for that week. */
function MonthCalendar({
  anchor, onSelectWeek, onBack,
}: { anchor: string; onSelectWeek: (weekStart: string) => void; onBack: () => void }) {
  const [weeks, setWeeks] = useState<Record<string, WeekGrid> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const starts = weeksInMonth(anchor);

  useEffect(() => {
    setWeeks(null);
    setError(null);
    Promise.all(
      weeksInMonth(anchor).map((d) =>
        api
          .get<{ data: WeekGrid }>("/time/week", { params: { date: d, create: false } })
          .then((r) => [d, r.data.data] as const),
      ),
    )
      .then((entries) => setWeeks(Object.fromEntries(entries)))
      .catch((e) => setError(apiErrorMessage(e, "The month could not be loaded")));
  }, [anchor]);

  if (error) {
    return (
      <Card className="p-2">
        <ErrorState message={error} />
      </Card>
    );
  }
  if (!weeks) {
    return (
      <Card className="p-2">
        <Loading label="Loading month" />
      </Card>
    );
  }

  const monthStart = startOfMonth(parseISO(anchor));
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-engagement-line/70 bg-engagement-canvas/40 px-4 py-2.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-engagement-ink-faint transition-colors hover:text-engagement-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> {format(parseISO(anchor), "yyyy")}
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-engagement-line/70 bg-engagement-canvas/50 text-center text-[11px] font-semibold uppercase tracking-wider text-engagement-ink-faint">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-2.5">{d}</div>
        ))}
      </div>
      <div className="divide-y divide-engagement-line/60">
        {starts.map((ws) => {
          const grid = weeks[ws];
          if (!grid) return null;
          return (
            <button
              key={ws}
              type="button"
              onClick={() => onSelectWeek(ws)}
              className="flex w-full items-stretch text-left transition-colors hover:bg-engagement-accent-soft/40"
            >
              <div className="grid flex-1 grid-cols-7">
                {grid.days.map((d) => {
                  const inMonth = isSameMonth(parseISO(d), monthStart);
                  const mins = grid.day_totals[d] ?? 0;
                  const isToday = d === todayStr;
                  return (
                    <div key={d} className={clsx("flex flex-col items-center gap-1 py-3", !inMonth && "opacity-30")}>
                      <span
                        className={clsx(
                          "flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                          isToday ? "bg-engagement-accent text-white" : "text-engagement-ink",
                        )}
                      >
                        {format(parseISO(d), "d")}
                      </span>
                      <span className="font-engagement-mono text-[10px] tabular-nums text-engagement-ink-faint">
                        {mins > 0 ? fmtMinutes(mins) : " "}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex w-40 shrink-0 flex-col items-end justify-center gap-1.5 border-l border-engagement-line/60 px-4">
                <StatusBadge status={grid.timesheet.status} />
                <span className="font-engagement-mono text-xs tabular-nums text-engagement-ink-soft">
                  {fmtMinutes(grid.total_minutes)}{" "}
                  <span className="text-engagement-ink-faint">of {fmtMinutes(grid.capacity_minutes)}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** First stop in Month mode: pick a year, fixed to this-year ± 5 (not a paging
 * window — re-clicking the Month tab always lands back here at the same range). */
function YearGrid({ currentYear, onSelect }: { currentYear: number; onSelect: (year: number) => void }) {
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  return (
    <Card className="p-6">
      <p className="mb-5 text-sm text-engagement-ink-faint">Choose a year</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onSelect(y)}
            className={clsx(
              "rounded-xl py-3.5 text-center font-engagement-mono text-sm font-semibold tabular-nums transition-all duration-200",
              y === currentYear
                ? "bg-engagement-accent text-white shadow-sm shadow-engagement-accent/30"
                : "border border-engagement-line/70 text-engagement-ink-soft hover:-translate-y-0.5 hover:border-engagement-accent/40 hover:bg-engagement-canvas hover:text-engagement-ink hover:shadow-md",
            )}
          >
            {y}
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Second stop: all 12 months of the picked year, current month highlighted
 * (only if the picked year is actually this year). */
function MonthGrid({
  year, currentYear, currentMonthIndex, onSelect, onBack,
}: { year: number; currentYear: number; currentMonthIndex: number; onSelect: (monthIndex: number) => void; onBack: () => void }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-engagement-ink-faint transition-colors hover:text-engagement-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> All years
        </button>
        <h2 className="font-engagement-display text-base font-semibold tracking-tight">{year}</h2>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {MONTH_NAMES.map((name, i) => {
          const isCurrent = year === currentYear && i === currentMonthIndex;
          return (
            <button
              key={name}
              onClick={() => onSelect(i)}
              className={clsx(
                "rounded-xl py-3.5 text-center text-sm font-medium transition-all duration-200",
                isCurrent
                  ? "bg-engagement-accent text-white shadow-sm shadow-engagement-accent/30"
                  : "border border-engagement-line/70 text-engagement-ink-soft hover:-translate-y-0.5 hover:border-engagement-accent/40 hover:bg-engagement-canvas hover:text-engagement-ink hover:shadow-md",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** One week's fully editable timesheet grid. Fetches and manages its own state so
 * several of these can be stacked at once (month view) without stepping on each other. */
function WeekEditor({ date }: { date: string }) {
  const [grid, setGrid] = useState<WeekGrid | null>(null);
  const [util, setUtil] = useState<Utilization | null>(null);
  const [previousRows, setPreviousRows] = useState<GridRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // cellKey -> raw text
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [barFilled, setBarFilled] = useState(false);
  const [unlockedDays, setUnlockedDays] = useState<Set<string>>(new Set());
  const [weekendModalDate, setWeekendModalDate] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setGrid(null);
    api
      .get<{ data: WeekGrid }>(`/time/week`, { params: { date } })
      .then((r) => setGrid(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "The week could not be loaded")));
  }, [date]);

  useEffect(load, [load]);
  useEffect(() => setPendingRows([]), [date]);
  useEffect(() => setUnlockedDays(new Set()), [date]);

  useEffect(() => {
    if (!grid) return;
    setBarFilled(false);
    const id = requestAnimationFrame(() => setBarFilled(true));
    return () => cancelAnimationFrame(id);
  }, [grid?.total_minutes, grid?.capacity_minutes]);

  useEffect(() => {
    api
      .get<{ data: Utilization }>("/allocations/utilization", { params: { weeks: 1 } })
      .then((r) => setUtil(r.data.data))
      .catch(() => setUtil(null));
  }, []);

  useEffect(() => {
    const previousWeek = format(addWeeks(parseISO(date), -1), "yyyy-MM-dd");
    api
      .get<{ data: WeekGrid }>("/time/week", { params: { date: previousWeek, create: false } })
      .then((r) => setPreviousRows(r.data.data.rows))
      .catch(() => setPreviousRows([]));
  }, [date]);

  const editable = grid ? ["draft", "changes_requested"].includes(grid.timesheet.status) : false;

  const allRows: (GridRow | (PendingRow & { entries: Record<string, never>; total_minutes: number }))[] =
    useMemo(() => {
      if (!grid) return [];
      const serverKeys = new Set(grid.rows.map(rowKey));
      const pend = pendingRows
        .filter((p) => !serverKeys.has(rowKey(p)))
        .map((p) => ({ ...p, entries: {}, total_minutes: 0 }));
      return [...grid.rows, ...pend];
    }, [grid, pendingRows]);

  const existingKeys = useMemo(() => new Set(allRows.map(rowKey)), [allRows]);

  const copyCandidates = useMemo(
    () => (previousRows ?? []).filter((r) => !existingKeys.has(rowKey(r))),
    [previousRows, existingKeys],
  );

  const copyRow = (r: GridRow) => {
    setPendingRows((p) => [
      ...p,
      {
        project_id: r.project_id,
        project_name: r.project_name,
        client_name: r.client_name,
        task_id: r.task_id,
        task_name: r.task_name,
        billable: r.billable,
      },
    ]);
  };

  const saveCell = async (row: { project_id: string; task_id: string | null }, day: string, raw: string, note?: string | null) => {
    if (!grid) return;
    const minutes = parseToMinutes(raw);
    if (minutes === null) {
      toast.error("Enter time as hours (8, 7.5) or h:mm (7:30)");
      return;
    }
    const current = grid.rows.find((r) => rowKey(r) === rowKey(row))?.entries[day]?.minutes ?? 0;
    if (minutes === current && note === undefined) return;
    try {
      await api.put("/time/entries", {
        timesheet_id: grid.timesheet.id,
        project_id: row.project_id,
        task_id: row.task_id,
        work_date: day,
        minutes,
        note: note ?? undefined,
      });
      const r = await api.get<{ data: WeekGrid }>(`/time/week`, { params: { date } });
      setGrid(r.data.data);
    } catch (e) {
      toast.error(apiErrorMessage(e, "The entry could not be saved"));
      load();
    }
  };

  const editNote = async (row: GridRow, day: string) => {
    const existing = row.entries[day];
    const note = window.prompt("Note for this entry", existing?.note ?? "");
    if (note === null) return;
    if (!existing) {
      toast.error("Enter hours first, then add a note");
      return;
    }
    await saveCell(row, day, fmtMinutes(existing.minutes), note);
  };

  const removeRow = async (row: { project_id: string; task_id: string | null }) => {
    if (!grid) return;
    const isPending = !grid.rows.some((r) => rowKey(r) === rowKey(row));
    if (isPending) {
      setPendingRows((p) => p.filter((x) => rowKey(x) !== rowKey(row)));
      return;
    }
    if (!window.confirm("Remove this row and its hours for the week?")) return;
    try {
      await api.post("/time/rows/remove", {
        timesheet_id: grid.timesheet.id,
        project_id: row.project_id,
        task_id: row.task_id,
      });
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The row could not be removed"));
    }
  };

  const submitWeek = async () => {
    if (!grid) return;
    setSubmitting(true);
    try {
      await api.post(`/timesheets/${grid.timesheet.id}/submit`);
      toast.success("Timesheet submitted");
      setConfirming(false);
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The timesheet could not be submitted"));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <Card className="p-2">
        <ErrorState message={error} onRetry={load} />
      </Card>
    );
  }
  if (!grid) {
    return (
      <Card className="p-2">
        <Loading label="Loading week" />
      </Card>
    );
  }

  const ws = parseISO(grid.timesheet.week_start_date);
  const we = parseISO(grid.timesheet.week_end_date);
  const pct = Math.min((grid.total_minutes / grid.capacity_minutes) * 100, 100);
  const overCapacity = grid.total_minutes > grid.capacity_minutes;
  const dailyCapacity = Math.floor(grid.capacity_minutes / 5);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isDayFull = (d: string) => (grid.day_totals[d] ?? 0) >= dailyCapacity && dailyCapacity > 0;
  const isCapacityLocked = (d: string) => isDayFull(d) && !unlockedDays.has(d);
  const unlockDay = (d: string) => setUnlockedDays((s) => new Set(s).add(d));
  const isWeekendDay = (d: string) => grid.weekend_days.includes(d);
  const isWeekendUnlocked = (d: string) => grid.weekend_unlocked_days.includes(d);
  const isWeekendLocked = (d: string) => isWeekendDay(d) && !isWeekendUnlocked(d);
  const isDayLocked = (d: string) => editable && (isCapacityLocked(d) || isWeekendLocked(d));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="font-engagement-display text-base font-semibold tracking-tight">
            {format(ws, "MMM d")} – {format(we, "MMM d, yyyy")}
          </h2>
          <StatusBadge status={grid.timesheet.status} />
        </div>
        <div className="flex items-center gap-4">
          {util && util.weeks[0]?.week_start_date === grid.timesheet.week_start_date && util.weeks[0].allocated_minutes > 0 && (
            <p className="text-xs text-engagement-ink-faint">
              Allocated{" "}
              <span className="font-engagement-mono tabular-nums text-engagement-ink-soft">
                {fmtMinutes(util.weeks[0].allocated_minutes)}
              </span>
            </p>
          )}
          <div className="w-48">
            <div className="mb-1 flex justify-between text-xs text-engagement-ink-faint">
              <span>
                Logged <span className="font-engagement-mono tabular-nums text-engagement-ink-soft">{fmtMinutes(grid.total_minutes)}</span>
              </span>
              <span>
                of <span className="font-engagement-mono tabular-nums text-engagement-ink-soft">{fmtMinutes(grid.capacity_minutes)}</span>
              </span>
            </div>
            <div
              className={clsx(
                "h-2 overflow-hidden rounded-full",
                grid.total_minutes >= grid.capacity_minutes ? "bg-engagement-ok-soft" : "bg-engagement-accent-soft",
              )}
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Week completion"
            >
              <div
                className={clsx(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  grid.total_minutes >= grid.capacity_minutes ? "bg-engagement-ok" : "bg-engagement-accent",
                )}
                style={{ width: `${barFilled ? pct : 0}%` }}
              />
            </div>
          </div>
          {editable && (
            <Button
              onClick={() => setConfirming(true)}
              disabled={grid.missing_working_days.length > 0 || overCapacity}
              title={
                grid.missing_working_days.length > 0
                  ? `Add hours to ${grid.missing_working_days.map((d) => format(parseISO(d), "EEEE")).join(", ")} first`
                  : overCapacity
                    ? `Reduce hours below ${fmtMinutes(grid.capacity_minutes)} before submitting`
                    : undefined
              }
            >
              Submit timesheet
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-7 gap-2">
        {grid.days.map((d) => {
          const day = parseISO(d);
          const total = grid.day_totals[d] ?? 0;
          const isToday = d === todayStr;
          const isWeekend = isWeekendDay(d);
          const ratio = Math.min(total / dailyCapacity, 1);
          const weekendLocked = editable && isWeekendLocked(d);
          const locked = isDayLocked(d);
          return (
            <div
              key={d}
              className={clsx(
                "relative rounded-lg border px-3 py-2.5 text-center transition-colors",
                isToday ? "border-engagement-accent bg-engagement-accent-soft/50" : "border-engagement-line bg-white",
                isWeekend && !isToday && total === 0 && "opacity-60",
                locked && "border-engagement-line bg-engagement-canvas/60 opacity-70 saturate-50",
              )}
            >
              {locked && weekendLocked && (
                <button
                  onClick={() => setWeekendModalDate(d)}
                  aria-label={`Add reason for working ${format(day, "EEEE dd MMM")}`}
                  title="Your weekend — click to add a reason and unlock"
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-engagement-ink-faint hover:bg-white hover:text-engagement-accent"
                >
                  <StickyNote className="h-3 w-3" aria-hidden />
                </button>
              )}
              {locked && !weekendLocked && (
                <button
                  onClick={() => unlockDay(d)}
                  aria-label={`Edit hours for ${format(day, "EEEE dd MMM")}`}
                  title="Day is full — click to edit"
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-engagement-ink-faint hover:bg-white hover:text-engagement-accent"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                </button>
              )}
              <p
                className={clsx(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  isToday ? "text-engagement-accent" : "text-engagement-ink-faint",
                )}
              >
                {format(day, "EEE")}
              </p>
              <p className="font-engagement-mono text-[10px] tabular-nums text-engagement-ink-faint">{format(day, "dd/MM")}</p>
              <p className="mt-1.5 font-engagement-mono text-lg font-semibold tabular-nums text-engagement-ink">
                {total > 0 ? fmtMinutes(total) : "–"}
              </p>
              {locked ? (
                <p className="mt-1.5 text-[10px] font-medium text-engagement-ok">{weekendLocked ? "Weekend" : "Full"}</p>
              ) : (
                <div className="mt-1.5 h-1 rounded-full bg-engagement-line">
                  <div
                    className={clsx("h-1 rounded-full", total >= dailyCapacity ? "bg-engagement-ok" : "bg-engagement-accent")}
                    style={{ width: `${Math.max(ratio * 100, total > 0 ? 8 : 0)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && grid.missing_working_days.length > 0 && (
        <p className="mb-4 rounded-md bg-engagement-warn-soft px-4 py-2.5 text-engagement-warn">
          Add hours to {grid.missing_working_days.map((d) => format(parseISO(d), "EEEE")).join(", ")} before you
          can submit this week.
        </p>
      )}
      {editable && overCapacity && (
        <p className="mb-4 rounded-md bg-engagement-bad-soft px-4 py-2.5 text-engagement-bad">
          You've logged {fmtMinutes(grid.total_minutes)}, over your {fmtMinutes(grid.capacity_minutes)} weekly
          capacity — reduce hours before you can submit this week.
        </p>
      )}
      {grid.timesheet.status === "submitted" && (
        <p className="mb-4 rounded-md bg-engagement-info-soft px-4 py-2.5 text-engagement-info">
          This week was submitted{grid.timesheet.submitted_at ? ` on ${format(parseISO(grid.timesheet.submitted_at), "MMM d 'at' HH:mm")}` : ""} and is waiting for review. It can no longer be edited.
        </p>
      )}
      {grid.timesheet.status === "approved" && (
        <p className="mb-4 rounded-md bg-engagement-ok-soft px-4 py-2.5 text-engagement-ok">
          This week has been approved and is read-only.
        </p>
      )}
      {grid.timesheet.reminder_stage === "grace" && (
        <p className="mb-4 rounded-md bg-engagement-info-soft px-4 py-2.5 text-engagement-info">
          This timesheet's due date ({format(parseISO(grid.timesheet.due_date), "EEEE, MMM d")}) has passed —
          submit soon, before it's marked Overdue.
        </p>
      )}
      {grid.timesheet.reminder_stage === "overdue" && (
        <p className="mb-4 rounded-md bg-engagement-warn-soft px-4 py-2.5 text-engagement-warn">
          Overdue — this timesheet was due {format(parseISO(grid.timesheet.due_date), "EEEE, MMM d")} and
          hasn't been submitted yet.
        </p>
      )}
      {grid.timesheet.reminder_stage === "escalated" && (
        <p className="mb-4 rounded-md bg-engagement-bad-soft px-4 py-2.5 text-engagement-bad">
          Overdue for over a week — your manager has been notified. Please submit as soon as possible.
        </p>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr className="border-b border-engagement-line text-xs uppercase tracking-wide text-engagement-ink-faint">
              <th className="w-72 px-4 py-3 text-left font-medium">Project / Task</th>
              {grid.days.map((d) => {
                const day = parseISO(d);
                const isToday = d === todayStr;
                return (
                  <th
                    key={d}
                    className={clsx("px-2 py-3 text-center font-medium", isToday && "bg-engagement-accent-soft/40")}
                  >
                    <span className={isToday ? "text-engagement-accent" : ""}>{format(day, "EEE")}</span>
                    <span className="block font-engagement-mono text-[11px] font-normal tabular-nums text-engagement-ink-faint">
                      {format(day, "dd/MM")}
                    </span>
                  </th>
                );
              })}
              <th className="w-24 px-4 py-3 text-right font-medium">Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {allRows.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    title="No time rows yet"
                    hint="Add a project row to start logging this week."
                  />
                </td>
              </tr>
            )}
            {allRows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-engagement-line last:border-b-0">
                <td className="px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-engagement-ink-faint">{row.client_name}</p>
                  <p className="font-medium text-engagement-ink">{row.project_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-engagement-ink-faint">
                    {row.task_name ?? "No specific task"}
                    {!row.billable && (
                      <span className="rounded-full bg-engagement-line/70 px-1.5 py-px text-[10px] font-medium">
                        Non-billable
                      </span>
                    )}
                  </p>
                </td>
                {grid.days.map((d) => {
                  const cellKey = `${rowKey(row)}|${d}`;
                  const entry = (row.entries as GridRow["entries"])[d];
                  const value = drafts[cellKey] ?? (entry ? fmtMinutes(entry.minutes) : "");
                  const weekend = isWeekendDay(d);
                  const isToday = d === todayStr;
                  const hasValue = Boolean(entry && entry.minutes > 0);
                  const weekendLocked = editable && isWeekendLocked(d);
                  const locked = isDayLocked(d);
                  return (
                    <td
                      key={d}
                      className={clsx("px-1.5 py-2", isToday ? "bg-engagement-accent-soft/40" : weekend && "bg-engagement-canvas/70")}
                    >
                      <div
                        className="relative"
                        onDoubleClick={() => weekendLocked && setWeekendModalDate(d)}
                      >
                        <input
                          aria-label={`Hours for ${row.project_name} on ${format(parseISO(d), "EEEE dd MMM")}`}
                          className={clsx(
                            "cell-input",
                            editable && hasValue && "border-engagement-accent/30 bg-engagement-accent-soft/60 font-semibold",
                            locked && "opacity-60 saturate-50",
                          )}
                          inputMode="decimal"
                          disabled={!editable || locked}
                          value={value}
                          data-cell={cellKey}
                          onChange={(e) => setDrafts((s) => ({ ...s, [cellKey]: e.target.value }))}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            setDrafts(({ [cellKey]: _, ...rest }) => rest);
                            saveCell(row, d, raw);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                        {entry?.note && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-engagement-accent" title={entry.note} />
                        )}
                      </div>
                      {locked && weekendLocked && (
                        <button
                          onClick={() => setWeekendModalDate(d)}
                          className="mx-auto mt-0.5 flex items-center gap-1 text-[10px] text-engagement-ink-faint hover:text-engagement-accent"
                          aria-label={`Add reason for working ${format(parseISO(d), "EEEE dd MMM")}`}
                        >
                          <StickyNote className="h-3 w-3" aria-hidden /> add reason
                        </button>
                      )}
                      {locked && !weekendLocked && (
                        <button
                          onClick={() => unlockDay(d)}
                          className="mx-auto mt-0.5 flex items-center gap-1 text-[10px] text-engagement-ink-faint hover:text-engagement-accent"
                          aria-label={`Edit hours for ${format(parseISO(d), "EEEE dd MMM")}`}
                        >
                          <Pencil className="h-3 w-3" aria-hidden /> edit
                        </button>
                      )}
                      {!locked && editable && entry && (
                        <button
                          onClick={() => editNote(row as GridRow, d)}
                          className="mx-auto mt-0.5 flex items-center gap-1 text-[10px] text-engagement-ink-faint hover:text-engagement-accent"
                          aria-label={`Edit note for ${format(parseISO(d), "EEE dd")}`}
                        >
                          <StickyNote className="h-3 w-3" aria-hidden /> note
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-engagement-mono text-sm font-medium tabular-nums">
                  {fmtMinutes(row.total_minutes)}
                </td>
                <td className="pr-3">
                  {editable && (
                    <button
                      onClick={() => removeRow(row)}
                      aria-label={`Remove ${row.project_name} row`}
                      className="rounded p-1.5 text-engagement-ink-faint hover:bg-engagement-bad-soft hover:text-engagement-bad"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-engagement-canvas/60">
              <td className="px-4 py-3" colSpan={8}>
                {editable && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={() => setAdding(true)}>
                      <Plus className="h-4 w-4" aria-hidden /> Add time row
                    </Button>
                    {copyCandidates.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-engagement-ink-faint">Copy from last week</span>
                        {copyCandidates.map((r) => (
                          <button
                            key={rowKey(r)}
                            type="button"
                            onClick={() => copyRow(r)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-engagement-line bg-white px-2.5 py-1 text-xs font-medium text-engagement-ink-soft transition-colors hover:border-engagement-accent hover:text-engagement-accent"
                          >
                            <Copy className="h-3 w-3" aria-hidden />
                            {r.client_name} / {r.project_name}
                            {r.task_name && <span className="text-engagement-ink-faint">· {r.task_name}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right font-engagement-mono text-sm font-semibold tabular-nums text-engagement-accent">
                {fmtMinutes(grid.total_minutes)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>

      <p className="mt-3 text-xs text-engagement-ink-faint">
        Billable this week:{" "}
        <span className="font-engagement-mono tabular-nums">{fmtMinutes(grid.billable_minutes)}</span> · Enter time
        as hours (8, 7.5) or h:mm (7:30). Entries save when you leave a cell.
      </p>

      {adding && (
        <AddRowModal
          existingKeys={existingKeys}
          onClose={() => setAdding(false)}
          onAdd={(row) => setPendingRows((p) => [...p, row])}
        />
      )}

      {weekendModalDate && (
        <WeekendReasonModal
          timesheetId={grid.timesheet.id}
          date={weekendModalDate}
          onClose={() => setWeekendModalDate(null)}
          onLogged={load}
        />
      )}

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-engagement-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="font-engagement-display text-base font-semibold">Submit this week?</h2>
            <p className="mt-2 text-engagement-ink-soft">
              You are submitting{" "}
              <span className="font-engagement-mono tabular-nums">{fmtMinutes(grid.total_minutes)}</span> for{" "}
              {format(ws, "MMM d")} – {format(we, "MMM d")}. After submitting, the week is locked for
              review and can no longer be edited.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Keep editing
              </Button>
              <Button onClick={submitWeek} busy={submitting}>
                Submit timesheet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type MonthStage = "year" | "month" | "calendar";

export default function TimeEntries() {
  const [params, setParams] = useSearchParams();
  const dateParam = params.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const [jumpUnit, setJumpUnit] = useState<JumpUnit>("week");
  // Month mode drills down Year -> Month -> the week-by-week calendar (built
  // earlier). Clicking the "Month" tab always restarts at the year picker —
  // it's a fresh pick each time, not a resume-where-you-left-off view.
  const [monthStage, setMonthStage] = useState<MonthStage>("year");
  const [pickedYear, setPickedYear] = useState(() => new Date().getFullYear());

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const showArrows = jumpUnit === "week" || monthStage === "calendar";

  const gotoDate = (delta: number) => {
    if (delta === 0) {
      setParams({ date: format(new Date(), "yyyy-MM-dd") });
      return;
    }
    const base = parseISO(dateParam);
    const d = jumpUnit === "month" ? addMonths(base, delta) : addWeeks(base, delta);
    setParams({ date: format(d, "yyyy-MM-dd") });
  };

  const openMonthMode = () => {
    setJumpUnit("month");
    setMonthStage("year");
    setPickedYear(currentYear);
  };

  const selectYear = (year: number) => {
    setPickedYear(year);
    setMonthStage("month");
  };

  const selectMonth = (monthIndex: number) => {
    setParams({ date: format(new Date(pickedYear, monthIndex, 1), "yyyy-MM-dd") });
    setMonthStage("calendar");
  };

  const selectWeek = (weekStart: string) => {
    setJumpUnit("week");
    setParams({ date: weekStart });
  };

  const backToMonths = () => {
    setPickedYear(parseISO(dateParam).getFullYear());
    setMonthStage("month");
  };

  const heading =
    jumpUnit === "week"
      ? `${format(startOfWeek(parseISO(dateParam), { weekStartsOn: 1 }), "MMM d")} – ${format(
          endOfWeek(parseISO(dateParam), { weekStartsOn: 1 }),
          "MMM d, yyyy",
        )}`
      : monthStage === "year"
        ? "Select a year"
        : monthStage === "month"
          ? String(pickedYear)
          : format(parseISO(dateParam), "MMMM yyyy");

  const jumpToMonthOfCurrentWeek = () => {
    setJumpUnit("month");
    setPickedYear(parseISO(dateParam).getFullYear());
    setMonthStage("month");
  };

  return (
    <div>
      <Card className="mb-5 flex flex-wrap items-center gap-4 p-3">
        {showArrows && (
          <>
            <div className="flex items-center rounded-lg border border-engagement-line bg-white">
              <button
                aria-label={`Previous ${jumpUnit}`}
                onClick={() => gotoDate(-1)}
                className="rounded-l-lg p-2 text-engagement-ink-soft transition-colors hover:bg-engagement-canvas hover:text-engagement-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="h-5 w-px bg-engagement-line" aria-hidden />
              <button
                aria-label={`Next ${jumpUnit}`}
                onClick={() => gotoDate(1)}
                className="rounded-r-lg p-2 text-engagement-ink-soft transition-colors hover:bg-engagement-canvas hover:text-engagement-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button variant="secondary" onClick={() => gotoDate(0)}>
              Today
            </Button>
          </>
        )}
        <div className="flex rounded-lg border border-engagement-line bg-white p-0.5">
          {(Object.keys(JUMP_UNIT_LABEL) as JumpUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => (u === "month" ? openMonthMode() : setJumpUnit("week"))}
              title={`Jump by ${u}`}
              className={clsx(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                jumpUnit === u ? "bg-engagement-accent text-white" : "text-engagement-ink-soft hover:text-engagement-ink",
              )}
            >
              {JUMP_UNIT_LABEL[u]}
            </button>
          ))}
        </div>
        {jumpUnit === "week" ? (
          <button
            onClick={jumpToMonthOfCurrentWeek}
            title="Jump to a different month or year"
            className="ml-1 rounded-lg px-2 py-1 font-engagement-display text-xl font-semibold tracking-tight text-engagement-ink transition-colors hover:bg-engagement-canvas hover:text-engagement-accent"
          >
            {heading}
          </button>
        ) : (
          <h1 className="ml-1 font-engagement-display text-xl font-semibold tracking-tight">{heading}</h1>
        )}
      </Card>

      <div className="space-y-8">
        {jumpUnit === "week" && <WeekEditor date={dateParam} />}
        {jumpUnit === "month" && monthStage === "year" && (
          <YearGrid currentYear={currentYear} onSelect={selectYear} />
        )}
        {jumpUnit === "month" && monthStage === "month" && (
          <MonthGrid
            year={pickedYear}
            currentYear={currentYear}
            currentMonthIndex={currentMonthIndex}
            onSelect={selectMonth}
            onBack={() => setMonthStage("year")}
          />
        )}
        {jumpUnit === "month" && monthStage === "calendar" && (
          <MonthCalendar anchor={dateParam} onSelectWeek={selectWeek} onBack={backToMonths} />
        )}
      </div>
    </div>
  );
}
