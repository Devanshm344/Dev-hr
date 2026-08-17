import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfWeek, subWeeks } from "date-fns";
import { Download } from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, apiErrorMessage } from "../api/client";
import type { PortfolioClient, ReportsDashboard, TimeReport } from "../api/types";
import { useEngagementUser } from "../api/context";
import { Button, Card, Loading, ErrorState, PageTitle, EmptyState } from "../components/ui";
import { fmtHours } from "../utils/time";

const GROUPS = [
  { value: "project", label: "Project" },
  { value: "task", label: "Task" },
  { value: "person", label: "Person" },
  { value: "day", label: "Day" },
];

// Validated categorical palette (fixed hue order — see dataviz skill, palette.md).
// Slot 1 (blue) matches this app's accent, so the chart identity hue lines up with the UI.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

// Documented sequential blue ramp, light -> dark (13 steps, 100 -> 700).
const SEQUENTIAL_STEPS = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
  "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b",
];

function sequentialStep(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "#F7F8FA";
  const idx = Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor((value / max) * SEQUENTIAL_STEPS.length));
  return SEQUENTIAL_STEPS[idx];
}

function cellTextClass(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "text-engagement-ink-faint";
  const idx = Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor((value / max) * SEQUENTIAL_STEPS.length));
  return idx >= 7 ? "text-white" : "text-engagement-ink";
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-engagement-ink-faint">{label}</p>
      <p className="mt-2 font-engagement-mono text-2xl font-semibold tabular-nums text-engagement-ink">{value}</p>
    </Card>
  );
}

// Fixed two-series legend — same slots/order as the lines below, never cycled.
const PROJECT_TREND_SERIES = [
  { key: "total_minutes", name: "Total hours", color: CATEGORICAL[0] },
  { key: "billable_minutes", name: "Billable hours", color: CATEGORICAL[1] },
] as const;

function ProjectComparisonLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {PROJECT_TREND_SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
          <span className="text-engagement-ink-soft">{s.name}</span>
        </li>
      ))}
    </ul>
  );
}

function ProjectComparisonTooltip({ active, label, payload }: { active?: boolean; label?: string; payload?: { name?: string; value?: number; color?: string }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-engagement-line bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-engagement-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} aria-hidden />
          <span className="font-engagement-mono tabular-nums text-engagement-ink">{fmtHours(p.value ?? 0)} hrs</span>
          <span className="text-engagement-ink-faint">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

function ProjectComparison({ rows }: { rows: ReportsDashboard["by_project"] }) {
  const total = useMemo(() => rows.reduce((sum, r) => sum + r.total_minutes, 0), [rows]);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Hours by project</h2>
          <p className="mt-0.5 text-xs text-engagement-ink-faint">Total vs billable hours, this range</p>
        </div>
        <span className="shrink-0 font-engagement-mono text-xs tabular-nums text-engagement-ink-faint">{fmtHours(total)} hrs total</span>
      </div>
      <div className="mt-3" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: 4, right: 12, top: 8, bottom: 4 }} barGap={2} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="#e9ebe7" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#898781", fontSize: 12 }}
              tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
            />
            <YAxis
              tickFormatter={(v: number) => fmtHours(v, 0)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#898781", fontSize: 12 }}
              width={40}
            />
            <Tooltip content={<ProjectComparisonTooltip />} cursor={{ fill: "#F7F8FA" }} />
            {PROJECT_TREND_SERIES.map((s) => (
              <Bar key={s.key} name={s.name} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2">
        <ProjectComparisonLegend />
      </div>
    </Card>
  );
}

function AssociateColumns({ rows }: { rows: NonNullable<ReportsDashboard["by_person"]> }) {
  return (
    <Card className="p-5">
      <h2 className="font-medium">Hours by associate</h2>
      <p className="mt-0.5 text-xs text-engagement-ink-faint">Logged hours per person, this range</p>
      <div className="mt-3" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: 4, right: 12, top: 8, bottom: 4 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#e9ebe7" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#898781", fontSize: 12 }}
              tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
            />
            <YAxis
              tickFormatter={(v: number) => fmtHours(v, 0)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#898781", fontSize: 12 }}
              width={40}
            />
            <Tooltip content={<ProjectComparisonTooltip />} cursor={{ fill: "#F7F8FA" }} />
            <Bar name="Hours" dataKey="total_minutes" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ProjectEmployeeHeatmap({ dashboard }: { dashboard: ReportsDashboard }) {
  const projects = dashboard.by_project;
  const people = dashboard.by_person ?? [];
  const cellMap = useMemo(() => {
    const m = new Map<string, number>();
    (dashboard.matrix ?? []).forEach((c) => m.set(`${c.user_id}:${c.project_id}`, c.total_minutes));
    return m;
  }, [dashboard.matrix]);
  const max = useMemo(
    () => (dashboard.matrix ?? []).reduce((mx, c) => Math.max(mx, c.total_minutes), 0),
    [dashboard.matrix],
  );

  if (people.length === 0 || projects.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="font-medium">Hours by project &amp; associate</h2>
        <EmptyState title="No time in this range" hint="Widen the dates to see the breakdown." />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-medium">Hours by project &amp; associate</h2>
      <p className="mt-0.5 text-xs text-engagement-ink-faint">Each cell is one person's logged hours on one project</p>
      <div className="mt-3 overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-xs font-medium text-engagement-ink-faint">
                Associate
              </th>
              {projects.map((p) => (
                <th
                  key={p.project_id}
                  title={p.label}
                  className="max-w-[120px] truncate px-2 py-1 text-left text-xs font-medium text-engagement-ink-faint"
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.user_id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left text-sm font-medium text-engagement-ink"
                >
                  {person.label}
                </th>
                {projects.map((p) => {
                  const minutes = cellMap.get(`${person.user_id}:${p.project_id}`) ?? 0;
                  return (
                    <td
                      key={p.project_id}
                      title={`${person.label} — ${p.label}: ${fmtHours(minutes)} hrs`}
                      className={clsx(
                        "min-w-[64px] rounded px-2 py-2 text-right font-engagement-mono text-xs tabular-nums",
                        cellTextClass(minutes, max),
                      )}
                      style={{ backgroundColor: sequentialStep(minutes, max) }}
                    >
                      {minutes > 0 ? fmtHours(minutes, 1) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-engagement-ink-faint">
        <span>Fewer hours</span>
        <span className="flex h-2 w-32 overflow-hidden rounded-full">
          {SEQUENTIAL_STEPS.map((c) => (
            <span key={c} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </span>
        <span>More hours</span>
      </div>
    </Card>
  );
}

export default function Reports() {
  const user = useEngagementUser();
  const isManagerish = user.role === "manager" || user.role === "admin";
  const defaultStart = format(startOfWeek(subWeeks(new Date(), 3), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [groupBy, setGroupBy] = useState("project");
  const [projectId, setProjectId] = useState("");
  const [clients, setClients] = useState<PortfolioClient[]>([]);
  const [report, setReport] = useState<TimeReport | null>(null);
  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const groups = useMemo(
    () => (user.role === "employee" ? GROUPS.filter((g) => g.value !== "person") : GROUPS),
    [user.role],
  );

  useEffect(() => {
    api
      .get<{ data: PortfolioClient[] }>("/portfolio/overview")
      .then((r) => setClients(r.data.data))
      .catch(() => {});
  }, []);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ data: TimeReport }>("/reports/time", {
        params: { start, end, group_by: groupBy, project_id: projectId || undefined },
      }),
      api.get<{ data: ReportsDashboard }>("/reports/dashboard", {
        params: { start, end, project_id: projectId || undefined },
      }),
    ])
      .then(([r, d]) => {
        setReport(r.data.data);
        setDashboard(d.data.data);
      })
      .catch((e) => setError(apiErrorMessage(e, "The report could not be generated")))
      .finally(() => setLoading(false));
  }, [start, end, groupBy, projectId]);

  useEffect(run, []);

  const download = async () => {
    try {
      const r = await api.get("/reports/time/export", {
        params: { start, end, group_by: groupBy, project_id: projectId || undefined },
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `time-report_${start}_${end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(apiErrorMessage(e, "The export could not be downloaded"));
    }
  };

  const field = "h-9 rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent";

  return (
    <div>
      <PageTitle
        title="Reports"
        sub="Time logged across projects and people"
        actions={
          <Button variant="secondary" onClick={download} disabled={!report || report.rows.length === 0}>
            <Download className="h-4 w-4" aria-hidden /> Download CSV
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="r-start" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
            From
          </label>
          <input id="r-start" type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="r-end" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
            To
          </label>
          <input id="r-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="r-group" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
            Group by
          </label>
          <select id="r-group" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={field}>
            {groups.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="r-project" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
            Project
          </label>
          <select id="r-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
            <option value="">Projects</option>
            {clients.flatMap((c) =>
              c.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {c.name} / {p.name}
                </option>
              )),
            )}
          </select>
        </div>
        <Button onClick={run} busy={loading}>
          Run report
        </Button>
      </Card>

      {error && <ErrorState message={error} onRetry={run} />}
      {!error && !dashboard && <Loading label="Generating report" />}

      {!error && dashboard && (
        <div className={clsx("space-y-4", loading && "opacity-50 transition-opacity")}>
          <div className={clsx("grid grid-cols-2 gap-4", isManagerish ? "lg:grid-cols-4" : "sm:grid-cols-3")}>
            <StatTile label="Total hours" value={fmtHours(dashboard.total_minutes)} />
            <StatTile label="Billable hours" value={fmtHours(dashboard.billable_minutes)} />
            <StatTile label="Projects" value={String(dashboard.project_count)} />
            {isManagerish && <StatTile label="Team members" value={String(dashboard.contributor_count ?? 0)} />}
          </div>

          {dashboard.by_project.length === 0 ? (
            <Card className="p-5">
              <EmptyState title="No time in this range" hint="Widen the dates or clear the project filter." />
            </Card>
          ) : (
            <>
              <div className={clsx("grid gap-4", isManagerish ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
                <ProjectComparison rows={dashboard.by_project} />
                {isManagerish && dashboard.by_person && <AssociateColumns rows={dashboard.by_person} />}
              </div>
              {isManagerish && <ProjectEmployeeHeatmap dashboard={dashboard} />}
            </>
          )}
        </div>
      )}

      {!error && report && (
        <Card className="mt-4">
          {report.rows.length === 0 ? (
            <EmptyState title="No time in this range" hint="Widen the dates or clear the project filter." />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
                  <th className="px-5 py-3 font-medium">{GROUPS.find((g) => g.value === report.group_by)?.label}</th>
                  <th className="px-5 py-3 text-right font-medium">Hours</th>
                  <th className="px-5 py-3 text-right font-medium">Billable</th>
                  <th className="px-5 py-3 text-right font-medium">Entries</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.label} className="border-b border-engagement-line last:border-b-0">
                    <td className="px-5 py-3 font-medium">{r.label}</td>
                    <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtHours(r.total_minutes)}</td>
                    <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtHours(r.billable_minutes)}</td>
                    <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{r.entry_count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-engagement-canvas/60 font-medium">
                  <td className="px-5 py-3">Total</td>
                  <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtHours(report.total_minutes)}</td>
                  <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtHours(report.billable_minutes)}</td>
                  <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">
                    {report.rows.reduce((a, r) => a + r.entry_count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
