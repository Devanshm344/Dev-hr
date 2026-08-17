import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpDown, ChevronDown, ChevronUp, Columns3, Download, Pencil, Plus, Search, X } from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { Client, PortfolioClient, PortfolioProject } from "../api/types";
import { useEngagementUser } from "../api/context";
import { Button, Card, Loading, ErrorState, PageTitle, StatusBadge, EmptyState } from "../components/ui";
import { fmtHours } from "../utils/time";
import { ClientForm } from "../components/ClientForm";
import { ProjectForm } from "../components/ProjectForm";

const BILLING_LABEL: Record<string, string> = {
  time_and_materials: "Time & materials",
  fixed_fee: "Fixed fee",
  non_billable: "Non-billable",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

type Row = PortfolioProject & { client_id: string; client_name: string };

type SortKey = "name" | "project_code" | "client_name" | "project_manager" | "billing_model" | "task_count" | "logged_minutes" | "status";

const COLUMNS: { key: string; label: string; sortKey: SortKey; align?: "right" }[] = [
  { key: "code", label: "Code", sortKey: "project_code" },
  { key: "client", label: "Client", sortKey: "client_name" },
  { key: "manager", label: "Manager", sortKey: "project_manager" },
  { key: "billing", label: "Billing", sortKey: "billing_model" },
  { key: "tasks", label: "Tasks", sortKey: "task_count", align: "right" },
  { key: "hours", label: "Hours logged", sortKey: "logged_minutes", align: "right" },
  { key: "status", label: "Status", sortKey: "status" },
];

function cellValue(r: Row, key: SortKey): string | number {
  switch (key) {
    case "name": return r.name;
    case "project_code": return r.project_code;
    case "client_name": return r.client_name;
    case "project_manager": return r.project_manager ?? "";
    case "billing_model": return BILLING_LABEL[r.billing_model] ?? r.billing_model;
    case "task_count": return r.task_count;
    case "logged_minutes": return r.logged_minutes;
    case "status": return STATUS_LABEL[r.status] ?? r.status;
  }
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function Th({
  label, sortKey, sort, onSort, align,
}: {
  label: string; sortKey: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; align?: "right";
}) {
  const active = sort.key === sortKey;
  return (
    <th className={clsx("px-4 py-3", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={clsx(
          "inline-flex items-center gap-1 hover:text-engagement-ink",
          align === "right" && "flex-row-reverse",
        )}
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

export default function Portfolio() {
  const user = useEngagementUser();
  const navigate = useNavigate();
  const canManage = user.role === "manager" || user.role === "admin";

  const [clients, setClients] = useState<PortfolioClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<Client | "new" | null>(null);
  const [projectForm, setProjectForm] = useState<{ defaultClientId?: string } | null>(null);

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [billingFilter, setBillingFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "client_name", dir: 1 });
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, true])),
  );
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: PortfolioClient[] }>("/portfolio/overview")
      .then((r) => setClients(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "The portfolio could not be loaded")));
  };
  useEffect(load, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const editClient = async (clientId: string) => {
    try {
      const r = await api.get<{ data: Client[] }>("/portfolio/clients");
      const found = r.data.data.find((c) => c.id === clientId);
      if (found) setClientForm(found);
    } catch (e) {
      toast.error(apiErrorMessage(e, "The client could not be loaded"));
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!clients) return <Loading label="Loading portfolio" />;

  const rows: Row[] = clients.flatMap((c) =>
    c.projects.map((p) => ({ ...p, client_id: c.id, client_name: c.name })),
  );

  const filtered = rows.filter((r) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${r.name} ${r.project_code} ${r.client_name}`.toLowerCase().includes(q)) return false;
    }
    if (clientFilter && r.client_id !== clientFilter) return false;
    if (billingFilter && r.billing_model !== billingFilter) return false;
    if (statusFilter) {
      if (r.status !== statusFilter) return false;
    } else if (!showArchived && r.status === "archived") {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = cellValue(a, sort.key);
    const bv = cellValue(b, sort.key);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return cmp !== 0 ? cmp * sort.dir : a.name.localeCompare(b.name) * sort.dir;
  });

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const exportCsv = () => {
    const cols = COLUMNS.filter((c) => visibleCols[c.key]);
    const lines = [
      ["Name", ...cols.map((c) => c.label)],
      ...sorted.map((r) => [r.name, ...cols.map((c) => String(cellValue(r, c.sortKey)))]),
    ];
    const csv = lines.map((line) => line.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "projects.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtersActive = search || clientFilter || billingFilter || statusFilter || showArchived;
  const clearFilters = () => {
    setSearch("");
    setClientFilter("");
    setBillingFilter("");
    setStatusFilter("");
    setShowArchived(false);
  };

  return (
    <div>
      <PageTitle
        title="Portfolio"
        sub="Clients and the projects you can see"
        actions={
          canManage && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setClientForm("new")}>
                <Plus className="h-4 w-4" aria-hidden /> New client
              </Button>
              <Button onClick={() => setProjectForm({})}>
                <Plus className="h-4 w-4" aria-hidden /> New project
              </Button>
            </div>
          )
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No projects yet" hint="You will see projects here once you are added as a member." />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-engagement-line/70 bg-engagement-canvas/40 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-engagement-ink-faint" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="h-9 w-52 rounded-lg border border-engagement-line bg-white pl-8 pr-2 text-sm outline-none transition-colors focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
              />
            </div>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="h-9 rounded-lg border border-engagement-line bg-white px-2 text-sm outline-none transition-colors focus:border-engagement-accent"
            >
              <option value="">Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              className="h-9 rounded-lg border border-engagement-line bg-white px-2 text-sm outline-none transition-colors focus:border-engagement-accent"
            >
              <option value="">Billing types</option>
              {Object.entries(BILLING_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-engagement-line bg-white px-2 text-sm outline-none transition-colors focus:border-engagement-accent"
            >
              <option value="">Status</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <label className="flex h-9 items-center gap-1.5 text-sm text-engagement-ink-soft">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-engagement-line text-engagement-accent focus:ring-engagement-accent-ring"
              />
              Show archived
            </label>
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="flex h-9 items-center gap-1 text-sm font-medium text-engagement-accent hover:text-engagement-accent-hover"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-engagement-ink-faint">
                {sorted.length} {sorted.length === 1 ? "project" : "projects"}
              </span>
              <div className="relative" ref={colsRef}>
                <button
                  onClick={() => setColsOpen((v) => !v)}
                  aria-label="Choose columns"
                  aria-expanded={colsOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-engagement-line bg-white text-engagement-ink-soft transition-colors hover:border-engagement-ink-faint hover:text-engagement-ink"
                >
                  <Columns3 className="h-4 w-4" aria-hidden />
                </button>
                {colsOpen && (
                  <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-engagement-line/70 bg-white p-1 shadow-lg">
                    {COLUMNS.map((c) => (
                      <label
                        key={c.key}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-engagement-ink-soft hover:bg-engagement-canvas"
                      >
                        <input
                          type="checkbox"
                          checked={visibleCols[c.key]}
                          onChange={(e) => setVisibleCols((v) => ({ ...v, [c.key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-engagement-line text-engagement-accent focus:ring-engagement-accent-ring"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={exportCsv}
                aria-label="Export CSV"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-engagement-line bg-white text-engagement-ink-soft transition-colors hover:border-engagement-ink-faint hover:text-engagement-ink"
              >
                <Download className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {sorted.length === 0 ? (
            <EmptyState title="No projects match your filters" hint="Try clearing a filter or the search box." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-engagement-line/70 bg-engagement-canvas/50 text-left text-[11px] font-semibold uppercase tracking-wider text-engagement-ink-faint">
                    <Th label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                    {COLUMNS.filter((c) => visibleCols[c.key]).map((c) => (
                      <Th key={c.key} label={c.label} sortKey={c.sortKey} sort={sort} onSort={toggleSort} align={c.align} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/engagement/portfolio/projects/${r.id}`)}
                      className="cursor-pointer border-b border-engagement-line/60 transition-colors last:border-b-0 hover:bg-engagement-accent-soft/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/engagement/portfolio/projects/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:text-engagement-accent"
                        >
                          {r.name}
                        </Link>
                      </td>
                      {visibleCols.code && (
                        <td className="px-4 py-3 font-engagement-mono text-xs text-engagement-ink-faint">{r.project_code}</td>
                      )}
                      {visibleCols.client && (
                        <td className="px-4 py-3">
                          {canManage ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                editClient(r.client_id);
                              }}
                              className="group inline-flex items-center gap-1 text-engagement-ink-soft hover:text-engagement-accent"
                            >
                              {r.client_name}
                              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" aria-hidden />
                            </button>
                          ) : (
                            r.client_name
                          )}
                        </td>
                      )}
                      {visibleCols.manager && <td className="px-4 py-3">{r.project_manager ?? "—"}</td>}
                      {visibleCols.billing && (
                        <td className="px-4 py-3">{BILLING_LABEL[r.billing_model] ?? r.billing_model}</td>
                      )}
                      {visibleCols.tasks && (
                        <td className="px-4 py-3 text-right font-engagement-mono tabular-nums">{r.task_count}</td>
                      )}
                      {visibleCols.hours && (
                        <td className="px-4 py-3 text-right font-engagement-mono tabular-nums">{fmtHours(r.logged_minutes)}</td>
                      )}
                      {visibleCols.status && (
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {clientForm && (
        <ClientForm
          client={clientForm === "new" ? null : clientForm}
          onClose={() => setClientForm(null)}
          onSaved={(saved) => {
            const wasNew = clientForm === "new";
            setClientForm(null);
            load();
            if (wasNew) setProjectForm({ defaultClientId: saved.id });
          }}
        />
      )}

      {projectForm && (
        <ProjectForm
          project={null}
          defaultClientId={projectForm.defaultClientId}
          onClose={() => setProjectForm(null)}
          onSaved={() => {
            setProjectForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}
