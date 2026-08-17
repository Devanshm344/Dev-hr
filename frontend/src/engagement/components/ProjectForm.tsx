import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { Client, ManagedUser, ProjectDetail } from "../api/types";
import { Button, Loading, ErrorState } from "./ui";
import { useEngagementUser } from "../api/context";

function suggestNextCode(projects: { project_code: string }[]): string {
  const max = projects.reduce((m, p) => {
    const match = /^PRJ-(\d+)$/.exec(p.project_code);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `PRJ-${String(max + 1).padStart(3, "0")}`;
}

function MembersPicker({
  allUsers,
  selected,
  onChange,
}: {
  allUsers: ManagedUser[];
  selected: ManagedUser[];
  onChange: (next: ManagedUser[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(selected.map((u) => u.id));
  const q = query.trim().toLowerCase();
  const results = q
    ? allUsers
        .filter((u) => !selectedIds.has(u.id))
        .filter((u) => `${u.first_name} ${u.last_name}`.toLowerCase().includes(q))
        .slice(0, 8)
    : [];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {selected.length === 0 && (
          <p className="text-xs text-engagement-ink-faint">No one added yet — search below to add people.</p>
        )}
        {selected.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 rounded-full bg-engagement-accent-soft px-2.5 py-1 text-xs font-medium text-engagement-accent"
          >
            {u.first_name} {u.last_name}
            <button
              type="button"
              onClick={() => onChange(selected.filter((s) => s.id !== u.id))}
              aria-label={`Remove ${u.first_name} ${u.last_name}`}
              className="rounded-full hover:bg-engagement-accent/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative mt-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anyone to add…"
          className="h-9 w-full rounded-md border border-engagement-line px-3 text-sm outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-engagement-line bg-white shadow-lg">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...selected, u]);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-engagement-accent-soft/40"
                >
                  <span>{u.first_name} {u.last_name}</span>
                  <span className="text-xs text-engagement-ink-faint">{u.job_title ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ProjectForm({
  project,
  defaultClientId,
  onClose,
  onSaved,
}: {
  project: ProjectDetail | null;
  defaultClientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useEngagementUser();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [managers, setManagers] = useState<ManagedUser[] | null>(null);
  const [allUsers, setAllUsers] = useState<ManagedUser[] | null>(null);
  const [members, setMembers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [projectCode, setProjectCode] = useState(project?.project_code ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [clientId, setClientId] = useState(project?.client_id ?? defaultClientId ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  // A manager creating a new project automatically becomes its PM unless they pick someone else.
  const [pmId, setPmId] = useState(
    project?.project_manager_id ?? (!project && user.role === "manager" ? user.id : ""),
  );
  const [pmName, setPmName] = useState(project?.project_manager_name ?? "");
  const [pmManual, setPmManual] = useState(Boolean(project?.project_manager_name));
  const [budgetAmount, setBudgetAmount] = useState(
    project?.budget_amount != null ? String(project.budget_amount) : "",
  );
  const [startDate, setStartDate] = useState(project?.start_date ?? "");
  const [endDate, setEndDate] = useState(project?.end_date ?? "");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [billingModel, setBillingModel] = useState(project?.billing_model ?? "time_and_materials");
  const [currency, setCurrency] = useState(project?.currency ?? "INR");

  useEffect(() => {
    Promise.all([
      api.get<{ data: Client[] }>("/portfolio/clients"),
      api.get<{ data: ManagedUser[] }>("/portfolio/users"),
      api.get<{ data: { projects: { project_code: string }[] }[] }>("/portfolio/overview"),
    ])
      .then(([c, u, overview]) => {
        setClients(c.data.data);
        setManagers(u.data.data.filter((p) => p.role === "manager" || p.role === "admin"));
        setAllUsers(u.data.data);
        if (!project) {
          const codes = overview.data.data.flatMap((cl) => cl.projects);
          setProjectCode((v) => v || suggestNextCode(codes));
          if (!clientId && c.data.data[0]) setClientId(c.data.data[0].id);
          // Your own team is staffed by default — search covers pulling in anyone else.
          setMembers(u.data.data.filter((p) => p.manager_id === user.id));
        }
      })
      .catch((e) => setError(apiErrorMessage(e, "Clients and managers could not be loaded")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!projectCode.trim() || !name.trim() || !clientId) {
      toast.error("Code, name, and client are required");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error("End date must be on or after the start date");
      return;
    }
    let budget: number | undefined;
    if (budgetAmount.trim() !== "") {
      budget = parseFloat(budgetAmount);
      if (Number.isNaN(budget) || budget < 0) {
        toast.error("Budget must be a positive number");
        return;
      }
    }
    const body = {
      project_code: projectCode.trim(),
      name: name.trim(),
      client_id: clientId,
      description: description || undefined,
      project_manager_id: pmManual ? undefined : pmId || undefined,
      project_manager_name: pmManual ? pmName.trim() || undefined : undefined,
      budget_amount: budget,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status,
      billing_model: billingModel,
      currency,
      member_ids: !project ? members.map((m) => m.id) : undefined,
    };
    setSaving(true);
    try {
      if (project) {
        await api.put(`/portfolio/projects/${project.id}`, body);
        toast.success("Project updated");
      } else {
        await api.post("/portfolio/projects", body);
        toast.success("Project created");
      }
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The project could not be saved"));
    } finally {
      setSaving(false);
    }
  };

  const loaded = clients !== null && managers !== null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-engagement-ink/40 p-4 pt-12 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-form-title"
    >
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-engagement-line px-5 py-4">
          <h2 id="project-form-title" className="font-engagement-display text-base font-semibold">
            {project ? "Edit project" : "New project"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-engagement-ink-faint hover:bg-engagement-line/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!loaded && !error && <Loading label="Loading" />}
          {error && <ErrorState message={error} />}
          {loaded && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pr-code" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Code
                  </label>
                  <input
                    id="pr-code"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                    className="h-9 w-full rounded-md border border-engagement-line px-3 font-engagement-mono outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="pr-name" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Name
                  </label>
                  <input
                    id="pr-name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line px-3 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pr-client" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Client
                  </label>
                  <select
                    id="pr-client"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                  >
                    <option value="">Choose a client…</option>
                    {clients!.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="pr-pm" className="block text-xs font-medium text-engagement-ink-soft">
                      Project manager
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPmManual((v) => !v);
                        setPmId("");
                        setPmName("");
                      }}
                      className="text-xs font-medium text-engagement-accent hover:text-engagement-accent-hover"
                    >
                      {pmManual ? "Choose from existing managers" : "Enter a name manually"}
                    </button>
                  </div>
                  {pmManual ? (
                    <input
                      id="pr-pm"
                      value={pmName}
                      onChange={(e) => setPmName(e.target.value)}
                      placeholder="Manager's name"
                      maxLength={200}
                      className="h-9 w-full rounded-md border border-engagement-line px-3 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                    />
                  ) : (
                    <select
                      id="pr-pm"
                      value={pmId}
                      onChange={(e) => setPmId(e.target.value)}
                      className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                    >
                      <option value="">Unassigned</option>
                      {managers!.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}
                        </option>
                      ))}
                    </select>
                  )}
                  {pmManual && (
                    <p className="mt-1 text-[11px] text-engagement-ink-faint">
                      Display only — this person won't get edit access or automatic time-logging membership.
                    </p>
                  )}
                </div>
              </div>

              {!project && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-engagement-ink-soft">Members</label>
                  <p className="mb-2 text-[11px] text-engagement-ink-faint">
                    Your direct reports are added automatically — search to add anyone else. You can adjust
                    who's on the project later from its detail page too.
                  </p>
                  <MembersPicker allUsers={allUsers ?? []} selected={members} onChange={setMembers} />
                </div>
              )}

              <div>
                <label htmlFor="pr-desc" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Description
                </label>
                <textarea
                  id="pr-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-engagement-line px-3 py-2 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pr-start" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Start date
                  </label>
                  <input
                    id="pr-start"
                    type="date"
                    value={startDate ?? ""}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line px-2 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
                <div>
                  <label htmlFor="pr-end" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    End date
                  </label>
                  <input
                    id="pr-end"
                    type="date"
                    value={endDate ?? ""}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line px-2 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
                <div>
                  <label htmlFor="pr-budget" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Budget
                  </label>
                  <input
                    id="pr-budget"
                    inputMode="decimal"
                    placeholder="Optional"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line px-3 font-engagement-mono outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pr-status" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Status
                  </label>
                  <select
                    id="pr-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pr-billing" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Billing model
                  </label>
                  <select
                    id="pr-billing"
                    value={billingModel}
                    onChange={(e) => setBillingModel(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                  >
                    <option value="time_and_materials">Time &amp; materials</option>
                    <option value="fixed_fee">Fixed fee</option>
                    <option value="non_billable">Non-billable</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pr-currency" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Currency
                  </label>
                  <input
                    id="pr-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="h-9 w-full rounded-md border border-engagement-line px-3 font-engagement-mono outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-engagement-line px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} busy={saving} disabled={!loaded}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
