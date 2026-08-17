import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { ArrowRight, Briefcase, CalendarRange, CheckSquare } from "lucide-react";
import { clsx } from "clsx";
import { api, apiErrorMessage } from "../api/client";
import type {
  ApprovalInboxItem, AuditWeek, MyAllocationRow, ProjectSummary, TimesheetSummary, Utilization, WeekGrid,
} from "../api/types";
import { useEngagementUser } from "../api/context";
import { Card, Loading, ErrorState, StatusBadge } from "../components/ui";
import { fmtMinutes } from "../utils/time";
import { formatDateInTz } from "../../utils/timezone";

const ALLOCATION_WEEKS = 6;

export default function Home() {
  const user = useEngagementUser();
  const isManagerish = user.role === "manager" || user.role === "admin";
  const [grid, setGrid] = useState<WeekGrid | null>(null);
  const [sheets, setSheets] = useState<TimesheetSummary[] | null>(null);
  const [audit, setAudit] = useState<AuditWeek[] | null>(null);
  const [util, setUtil] = useState<Utilization | null>(null);
  const [inbox, setInbox] = useState<ApprovalInboxItem[] | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [allocations, setAllocations] = useState<MyAllocationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [barFilled, setBarFilled] = useState(false);

  const load = () => {
    setError(null);
    Promise.all([
      api.get<{ data: WeekGrid }>("/time/week"),
      api.get<{ data: TimesheetSummary[] }>("/timesheets/my"),
      api.get<{ data: AuditWeek[] }>("/time/auditing", { params: { count: 4 } }),
      api.get<{ data: Utilization }>("/allocations/utilization", { params: { weeks: 1 } }),
      isManagerish ? api.get<{ data: ApprovalInboxItem[] }>("/approvals/inbox") : Promise.resolve(null),
      api.get<{ data: ProjectSummary }>("/reports/project-summary"),
      api.get<{ data: MyAllocationRow[] }>("/allocations/my", { params: { weeks: ALLOCATION_WEEKS } }),
    ])
      .then(([g, s, a, u, inb, ps, alloc]) => {
        setGrid(g.data.data);
        setSheets(s.data.data);
        setAudit(a.data.data);
        setUtil(u.data.data);
        setInbox(inb ? inb.data.data : []);
        setProjectSummary(ps.data.data);
        setAllocations(alloc.data.data);
      })
      .catch((e) => setError(apiErrorMessage(e, "Your dashboard could not be loaded")));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!grid) return;
    setBarFilled(false);
    const id = requestAnimationFrame(() => setBarFilled(true));
    return () => cancelAnimationFrame(id);
  }, [grid?.total_minutes, grid?.capacity_minutes]);

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }
  if (!grid || !sheets || !audit || !util || !projectSummary || !allocations) {
    return <Loading label="Loading your dashboard" />;
  }

  const allocatedMinutes = util.weeks[0]?.allocated_minutes ?? 0;
  const pct = Math.min((grid.total_minutes / grid.capacity_minutes) * 100, 100);
  const atCapacity = grid.total_minutes >= grid.capacity_minutes;
  const daysLogged = 5 - grid.missing_working_days.length;
  const attention = audit.filter(
    (w) => !w.is_current && (w.status === "not_started" || w.status === "draft" || w.status === "changes_requested"),
  );
  const review = grid.timesheet.latest_review;
  const needsChanges = review?.action === "changes_requested" && grid.timesheet.status === "changes_requested";

  const projectsTotal = projectSummary.client_projects + projectSummary.internal_projects;
  const maxProjectCount = Math.max(projectSummary.client_projects, projectSummary.internal_projects, 1);

  const weeklyAllocated = Array.from({ length: ALLOCATION_WEEKS }, (_, i) => {
    const ws = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
    const iso = format(ws, "yyyy-MM-dd");
    const minutes = allocations
      .filter((a) => a.week_start_date === iso)
      .reduce((sum, a) => sum + a.allocated_minutes, 0);
    return { week_start_date: iso, label: format(ws, "MMM d"), minutes };
  });
  const totalAllocatedMinutes = weeklyAllocated.reduce((sum, w) => sum + w.minutes, 0);
  const maxWeekMinutes = Math.max(...weeklyAllocated.map((w) => w.minutes), 1);

  // This employee's own local hour/day, not the device's system clock.
  const localHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: user.timezone || "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-engagement-display text-xl font-semibold tracking-tight">
          Good {localHour < 12 ? "Morning" : localHour < 17 ? "Afternoon" : "Evening"}, {user.first_name}
        </h1>
        <p className="mt-1 text-engagement-ink-faint">{formatDateInTz(new Date(), user.timezone, { withYear: false })}</p>
      </div>

      {needsChanges && review && (
        <div className="mb-4 rounded-md bg-engagement-warn-soft px-4 py-3 text-engagement-warn">
          <p className="font-medium">{review.reviewer_name} requested changes to this week</p>
          {review.comment && <p className="mt-1">{review.comment}</p>}
        </div>
      )}

      {isManagerish && (
        <div className="mb-4">
          <Link to="/engagement/approvals" className="block">
            <Card className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-engagement-accent/40">
              <div className="flex items-center justify-between">
                <p className="text-sm text-engagement-ink-faint">Timesheets awaiting review</p>
                <CheckSquare className="h-4 w-4 text-engagement-ink-faint" aria-hidden />
              </div>
              <p
                className={clsx(
                  "mt-2 font-engagement-mono text-2xl font-semibold tabular-nums",
                  (inbox?.length ?? 0) > 0 ? "text-engagement-accent" : "text-engagement-ink",
                )}
              >
                {inbox?.length ?? 0}
              </p>
              <p className="mt-3 text-xs text-engagement-ink-faint">
                {(inbox?.length ?? 0) > 0 ? "Submitted by your direct reports." : "Inbox zero."}
              </p>
            </Card>
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Present Week</h2>
            <StatusBadge status={grid.timesheet.status} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={clsx("h-1.5 w-6 rounded-full", i < daysLogged ? "bg-engagement-accent/60" : "bg-engagement-line")}
                />
              ))}
            </div>
            <span className="text-xs text-engagement-ink-faint">{daysLogged} of 5 days logged</span>
          </div>
          <p className="mt-4 font-engagement-mono text-3xl font-semibold tabular-nums">
            {fmtMinutes(grid.total_minutes)}
            <span className="ml-1.5 text-sm font-normal tracking-wide text-engagement-ink-faint">(hrs)</span>
            <span className="ml-2 text-base font-normal text-engagement-ink-faint">
              of {fmtMinutes(grid.capacity_minutes)}
            </span>
          </p>
          <div
            className={clsx(
              "mt-3 h-2 overflow-hidden rounded-full",
              atCapacity ? "bg-engagement-ok-soft" : "bg-engagement-accent-soft",
            )}
          >
            <div
              className={clsx(
                "h-full rounded-full transition-[width] duration-700 ease-out",
                atCapacity ? "bg-engagement-ok/60" : "bg-engagement-accent/60",
              )}
              style={{ width: `${barFilled ? pct : 0}%` }}
            />
          </div>
          {allocatedMinutes > 0 && (
            <p className="mt-1 text-engagement-ink-faint">
              Allocated <span className="font-engagement-mono tabular-nums text-engagement-ink-soft">{fmtMinutes(allocatedMinutes)}</span>{" "}
              this week
            </p>
          )}
          {grid.timesheet.reminder_stage === "grace" && (
            <p className="mt-1 font-medium text-engagement-info">
              Due date passed — submit soon before it's marked Overdue
            </p>
          )}
          {grid.timesheet.reminder_stage === "overdue" && (
            <p className="mt-1 font-medium text-engagement-warn">
              Overdue — was due {format(parseISO(grid.timesheet.due_date), "EEEE, MMM d")}
            </p>
          )}
          {grid.timesheet.reminder_stage === "escalated" && (
            <p className="mt-1 font-medium text-engagement-bad">Overdue for over a week — your manager was notified</p>
          )}
          <Link
            to="/engagement/time/entries"
            className="mt-5 inline-flex items-center gap-1 font-medium text-engagement-accent hover:text-engagement-accent-hover"
          >
            Open time entries <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Card>

        <Card className="p-5">
          <h2 className="font-medium">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="mt-4 text-engagement-ink-faint">You are all caught up. Past weeks are submitted.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.map((w) => (
                <li key={w.week_start_date} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/engagement/time/entries?date=${w.week_start_date}`}
                    className="text-engagement-accent hover:text-engagement-accent-hover"
                  >
                    {format(parseISO(w.week_start_date), "MMM d")} –{" "}
                    {format(parseISO(w.week_end_date), "MMM d")}
                  </Link>
                  <span className="flex items-center gap-1.5">
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
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">My Projects</h2>
            <Briefcase className="h-4 w-4 text-engagement-ink-faint" aria-hidden />
          </div>
          <p className="mt-0.5 text-[11px] text-engagement-ink-faint">
            {projectSummary.week_start_date
              ? `Your last approved week: ${format(parseISO(projectSummary.week_start_date), "MMM d")} – ${format(
                  parseISO(projectSummary.week_end_date!),
                  "MMM d, yyyy",
                )}`
              : "No approved week yet"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-engagement-ink-faint">Projects that week</p>
              <p className="mt-1 font-engagement-mono text-2xl font-semibold tabular-nums">
                {projectSummary.total_projects}
              </p>
            </div>
            <div>
              <p className="text-xs text-engagement-ink-faint">Still active</p>
              <p className="mt-1 font-engagement-mono text-2xl font-semibold tabular-nums text-engagement-accent">
                {projectSummary.active_projects}
              </p>
            </div>
          </div>

          {!projectSummary.week_start_date ? (
            <p className="mt-5 text-engagement-ink-faint">
              This fills in once your manager approves a week's timesheet.
            </p>
          ) : projectsTotal === 0 ? (
            <p className="mt-5 text-engagement-ink-faint">No projects logged in that week.</p>
          ) : (
            <div className="mt-5">
              <p className="mb-3 text-xs text-engagement-ink-faint">Client vs internal · hover the active bar to see which</p>
              <div className="flex items-end justify-center gap-10 px-2 pt-16">
                {[
                  {
                    label: "Client", total: projectSummary.client_projects, active: projectSummary.active_client_projects,
                    names: projectSummary.active_client_project_names, cls: "bg-engagement-accent",
                  },
                  {
                    label: "Internal", total: projectSummary.internal_projects, active: projectSummary.active_internal_projects,
                    names: projectSummary.active_internal_project_names, cls: "bg-engagement-info",
                  },
                ].map((b) => (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="font-engagement-mono text-sm font-semibold tabular-nums text-engagement-ink">
                      {b.total}
                    </span>
                    <div className="flex items-end gap-1.5">
                      <div
                        className={clsx("w-6 rounded-t opacity-35 transition-[height] duration-500 ease-out", b.cls)}
                        style={{ height: `${Math.max((b.total / maxProjectCount) * 72, b.total > 0 ? 6 : 2)}px` }}
                        title={`${b.label} projects worked on: ${b.total}`}
                      />
                      <div
                        className={clsx(
                          "group/bar relative w-6 rounded-t transition-[height] duration-500 ease-out",
                          b.active > 0 && "cursor-help",
                          b.cls,
                        )}
                        style={{ height: `${Math.max((b.active / maxProjectCount) * 72, b.active > 0 ? 6 : 2)}px` }}
                      >
                        {b.active > 0 && (
                          <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-52 -translate-x-1/2 -translate-y-full rounded-lg border border-engagement-line/70 bg-white p-3 text-xs opacity-0 shadow-lg transition-opacity duration-150 group-hover/bar:opacity-100">
                            <p className="font-semibold text-engagement-ink">
                              {b.label} — active now ({b.active})
                            </p>
                            <ul className="mt-1.5 space-y-1 text-engagement-ink-soft">
                              {b.names.map((name) => (
                                <li key={name} className="truncate" title={name}>
                                  {name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-engagement-ink-faint">{b.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-center gap-4 text-[11px] text-engagement-ink-faint">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-engagement-ink-faint/40" aria-hidden /> Total
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-engagement-ink-faint" aria-hidden /> Active
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Allocated Hours</h2>
            <CalendarRange className="h-4 w-4 text-engagement-ink-faint" aria-hidden />
          </div>
          <p className="mt-1 text-xs text-engagement-ink-faint">Next {ALLOCATION_WEEKS} weeks</p>
          <p className="mt-3 font-engagement-mono text-2xl font-semibold tabular-nums">
            {fmtMinutes(totalAllocatedMinutes)}
          </p>

          <div className="mt-4 flex items-end gap-3">
            {weeklyAllocated.map((w) => (
              <div key={w.week_start_date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-engagement-mono text-[11px] tabular-nums text-engagement-ink-soft">
                  {w.minutes > 0 ? fmtMinutes(w.minutes) : "—"}
                </span>
                <div
                  className="w-full rounded-t bg-engagement-accent/60 transition-[height] duration-500 ease-out"
                  style={{ height: `${Math.max((w.minutes / maxWeekMinutes) * 80, w.minutes > 0 ? 6 : 2)}px` }}
                />
                <span className="text-[11px] text-engagement-ink-faint">{w.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-engagement-line/70 bg-engagement-canvas/40 px-5 py-3">
          <h2 className="font-medium">Recent timesheets</h2>
          <Link to="/engagement/time/timesheets" className="text-sm text-engagement-accent hover:text-engagement-accent-hover">
            View all
          </Link>
        </div>
        <table className="w-full">
          <tbody>
            {sheets.slice(0, 4).map((s) => (
              <tr key={s.id} className="border-b border-engagement-line/60 transition-colors last:border-b-0 hover:bg-engagement-accent-soft/40">
                <td className="px-5 py-3">
                  <Link to={`/engagement/time/entries?date=${s.week_start_date}`} className="font-medium hover:text-engagement-accent">
                    {format(parseISO(s.week_start_date), "MMM d")} –{" "}
                    {format(parseISO(s.week_end_date), "MMM d, yyyy")}
                  </Link>
                </td>
                <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtMinutes(s.total_minutes)}</td>
                <td className="px-5 py-3 text-right">
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
