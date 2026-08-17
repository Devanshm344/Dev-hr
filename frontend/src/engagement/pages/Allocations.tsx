import { Fragment, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { AlertTriangle } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { AllocationMatrix, PortfolioClient } from "../api/types";
import { Card, Loading, ErrorState, PageTitle, EmptyState } from "../components/ui";
import { fmtMinutes, parseToMinutes } from "../utils/time";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function Allocations() {
  const [clients, setClients] = useState<PortfolioClient[] | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [matrix, setMatrix] = useState<AllocationMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .get<{ data: PortfolioClient[] }>("/portfolio/overview")
      .then((r) => {
        setClients(r.data.data);
        const firstProject = r.data.data.flatMap((c) => c.projects)[0];
        if (firstProject) setProjectId(firstProject.id);
      })
      .catch((e) => setError(apiErrorMessage(e, "Projects could not be loaded")));
  }, []);

  const loadMatrix = () => {
    if (!projectId) return;
    setError(null);
    api
      .get<{ data: AllocationMatrix }>("/allocations/matrix", { params: { project_id: projectId, weeks: 6 } })
      .then((r) => setMatrix(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "The allocation matrix could not be loaded")));
  };
  useEffect(loadMatrix, [projectId]);

  const saveCell = async (userId: string, week: string, raw: string) => {
    if (!matrix) return;
    const minutes = parseToMinutes(raw);
    if (minutes === null) {
      toast.error("Enter time as hours (40, 32.5) or h:mm (40:00)");
      return;
    }
    const current = matrix.people.find((p) => p.user_id === userId)?.cells[week]?.minutes ?? 0;
    if (minutes === current) return;
    try {
      await api.put("/allocations/cell", { project_id: projectId, user_id: userId, week_start_date: week, minutes });
      loadMatrix();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The allocation could not be saved"));
      loadMatrix();
    }
  };

  const projectOptions = useMemo(
    () => clients?.flatMap((c) => c.projects.map((p) => ({ id: p.id, label: `${c.name} / ${p.name}` }))) ?? [],
    [clients],
  );

  const thisWeek = matrix?.weeks[0];
  const stats = useMemo(() => {
    if (!matrix || !thisWeek) return null;
    let allocated = 0;
    let capacity = 0;
    let over = 0;
    for (const p of matrix.people) {
      const minutes = p.cells[thisWeek]?.minutes ?? 0;
      allocated += minutes;
      capacity += p.capacity_minutes;
      if (minutes > p.capacity_minutes) over += 1;
    }
    return { allocated, capacity, over, headcount: matrix.people.length };
  }, [matrix, thisWeek]);

  if (error) return <ErrorState message={error} onRetry={loadMatrix} />;
  if (!clients) return <Loading label="Loading projects" />;

  return (
    <div>
      <PageTitle
        title="Team Allocations"
        sub="Planned hours by person and week"
        actions={
          <select
            aria-label="Project"
            className="rounded-md border border-engagement-line bg-white px-3 py-2 text-sm outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        }
      />

      {stats && (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-engagement-ink-faint">Team hours this week</p>
            <p className="mt-2 font-engagement-mono text-2xl font-semibold tabular-nums">
              {fmtMinutes(stats.allocated)}
              <span className="ml-1.5 text-sm font-normal text-engagement-ink-faint">of {fmtMinutes(stats.capacity)}</span>
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-engagement-line">
              <div
                className="h-1.5 rounded-full bg-engagement-accent"
                style={{
                  width: `${stats.capacity > 0 ? Math.min((stats.allocated / stats.capacity) * 100, 100) : 0}%`,
                }}
              />
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-engagement-ink-faint">People on this project</p>
            <p className="mt-2 font-engagement-mono text-2xl font-semibold tabular-nums">{stats.headcount}</p>
            <p className="mt-3 text-xs text-engagement-ink-faint">Planned across the next 6 weeks</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-engagement-ink-faint">Over-allocated this week</p>
              {stats.over > 0 && <AlertTriangle className="h-4 w-4 text-engagement-warn" aria-hidden />}
            </div>
            <p
              className={clsx(
                "mt-2 font-engagement-mono text-2xl font-semibold tabular-nums",
                stats.over > 0 ? "text-engagement-warn" : "text-engagement-ink",
              )}
            >
              {stats.over}
            </p>
            <p className="mt-3 text-xs text-engagement-ink-faint">
              {stats.over > 0 ? "Above weekly capacity — review their hours." : "Everyone is within capacity."}
            </p>
          </Card>
        </div>
      )}

      {!matrix ? (
        <Loading label="Loading matrix" />
      ) : matrix.people.length === 0 ? (
        <Card>
          <EmptyState
            title="No members on this project"
            hint="Add people to the project before planning their hours."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-engagement-line text-xs uppercase tracking-wide text-engagement-ink-faint">
                <th className="w-64 px-4 py-3 text-left font-medium">Person</th>
                {matrix.weeks.map((w, i) => (
                  <th key={w} className={clsx("px-2 py-3 text-center font-medium", i === 0 && "text-engagement-accent")}>
                    {format(parseISO(w), "MMM d")}
                    {i === 0 && (
                      <span className="mt-0.5 block text-[10px] font-normal normal-case text-engagement-accent/70">
                        This week
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.people.map((p) => (
                <Fragment key={p.user_id}>
                  <tr>
                    <td rowSpan={2} className="border-b border-engagement-line px-4 py-3 align-top">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-engagement-accent text-xs font-semibold text-white">
                            {initials(p.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-engagement-ink">{p.name}</p>
                            <p className="truncate text-xs text-engagement-ink-faint">{p.job_title ?? "—"}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-engagement-canvas px-2 py-0.5 font-engagement-mono text-[11px] tabular-nums text-engagement-ink-faint">
                          {fmtMinutes(p.capacity_minutes)}/wk
                        </span>
                      </div>
                    </td>
                    {matrix.weeks.map((w, i) => {
                      const cellKey = `${p.user_id}|${w}`;
                      const cell = p.cells[w];
                      const value = drafts[cellKey] ?? (cell?.minutes ? fmtMinutes(cell.minutes) : "");
                      const over = (cell?.minutes ?? 0) > p.capacity_minutes;
                      return (
                        <td key={w} className={clsx("px-1.5 pb-1 pt-2.5", i === 0 && "bg-engagement-accent-soft/40")}>
                          <input
                            aria-label={`Allocated hours for ${p.name}, week of ${format(parseISO(w), "MMM d")}`}
                            className={`cell-input ${over ? "border-engagement-warn text-engagement-warn" : ""}`}
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => setDrafts((s) => ({ ...s, [cellKey]: e.target.value }))}
                            onBlur={(e) => {
                              const raw = e.target.value;
                              setDrafts(({ [cellKey]: _, ...rest }) => rest);
                              saveCell(p.user_id, w, raw);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-engagement-line last:border-b-0">
                    {matrix.weeks.map((w, i) => {
                      const minutes = p.cells[w]?.minutes ?? 0;
                      const over = minutes > p.capacity_minutes;
                      const ratio = p.capacity_minutes > 0 ? Math.min(minutes / p.capacity_minutes, 1) : 0;
                      return (
                        <td key={w} className={clsx("px-1.5 pb-2.5 pt-1", i === 0 && "bg-engagement-accent-soft/40")}>
                          <div
                            className="h-1.5 overflow-hidden rounded-full bg-engagement-line"
                            title={`${format(parseISO(w), "MMM d")}: ${fmtMinutes(minutes)} of ${fmtMinutes(p.capacity_minutes)} capacity`}
                          >
                            <div
                              className={clsx("h-full rounded-full", over ? "bg-engagement-warn" : "bg-engagement-accent")}
                              style={{ width: `${Math.max(ratio * 100, minutes > 0 ? 6 : 0)}%` }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-engagement-ink-faint">
        Enter planned hours as hours (40, 32.5) or h:mm (40:00) per person per week — the bar underneath shows that
        week's share of weekly capacity. <span className="text-engagement-warn">Amber</span> means over-allocated. Clearing a
        cell removes the allocation; saves when you leave a cell.
      </p>
    </div>
  );
}
