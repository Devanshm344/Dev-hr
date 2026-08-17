import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { api, apiErrorMessage } from "../api/client";
import type { ManagedUser, ProjectDetail as Detail, ProjectTask } from "../api/types";
import { useEngagementUser } from "../api/context";
import { Button, Card, Loading, ErrorState, StatusBadge, EmptyState } from "../components/ui";
import { ProjectForm } from "../components/ProjectForm";
import { TaskForm } from "../components/TaskForm";

const BILLING_LABEL: Record<string, string> = {
  time_and_materials: "Time & materials",
  fixed_fee: "Fixed fee",
  non_billable: "Non-billable",
};

function AddMemberRow({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [role, setRole] = useState<"member" | "project_manager">("member");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ data: ManagedUser[] }>("/portfolio/users")
      .then((r) => setUsers(r.data.data))
      .catch(() => setUsers([]));
  }, []);

  const q = query.trim().toLowerCase();
  const results =
    q && !selected
      ? (users ?? [])
          .filter(
            (u) =>
              `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
              u.employee_code.toLowerCase().includes(q),
          )
          .slice(0, 8)
      : [];

  const add = async () => {
    if (!selected) {
      toast.error("Choose a person to add");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/portfolio/projects/${projectId}/members`, { user_id: selected.id, project_role: role });
      toast.success("Member added");
      setSelected(null);
      setQuery("");
      onAdded();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The member could not be added"));
    } finally {
      setBusy(false);
    }
  };

  if (!users) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-56">
        <input
          aria-label="Search person by name or employee ID"
          value={selected ? `${selected.first_name} ${selected.last_name} · ${selected.employee_code}` : query}
          onChange={(e) => {
            setSelected(null);
            setQuery(e.target.value);
          }}
          placeholder="Search by name or employee ID…"
          className="h-9 w-full rounded-md border border-engagement-line px-3 text-sm outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-engagement-line bg-white shadow-lg">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-engagement-accent-soft/40"
                >
                  <span>
                    {u.first_name} {u.last_name}
                  </span>
                  <span className="text-xs text-engagement-ink-faint">{u.employee_code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <select
        aria-label="Project role"
        value={role}
        onChange={(e) => setRole(e.target.value as "member" | "project_manager")}
        className="h-9 rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
      >
        <option value="member">Member</option>
        <option value="project_manager">Project manager</option>
      </select>
      <Button variant="secondary" onClick={add} busy={busy}>
        <Plus className="h-4 w-4" aria-hidden /> Add
      </Button>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const user = useEngagementUser();
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [taskForm, setTaskForm] = useState<ProjectTask | "new" | null>(null);
  // Employees default to their own tasks; managers/admins default to the full team's.
  const [taskFilter, setTaskFilter] = useState<"mine" | "all">(user.role === "employee" ? "mine" : "all");

  const load = () => {
    setError(null);
    api
      .get<{ data: Detail }>(`/portfolio/projects/${id}`)
      .then((r) => setProject(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "The project could not be loaded")));
  };
  useEffect(load, [id]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await api.patch(`/portfolio/tasks/${taskId}/status`, { status });
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The task status could not be updated"));
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this project?`)) return;
    try {
      await api.delete(`/portfolio/projects/${id}/members/${userId}`);
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The member could not be removed"));
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!project) return <Loading label="Loading project" />;

  const visibleTasks = taskFilter === "mine" ? project.tasks.filter((t) => t.assigned_to === user.id) : project.tasks;
  const taskCountFor = (memberId: string) => {
    const assigned = project.tasks.filter((t) => t.assigned_to === memberId);
    return { done: assigned.filter((t) => t.status === "completed").length, total: assigned.length };
  };

  const fact = (label: string, value: string) => (
    <div>
      <dt className="text-xs uppercase tracking-wide text-engagement-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );

  return (
    <div>
      <Link to="/engagement/portfolio" className="mb-4 inline-flex items-center gap-1 text-sm text-engagement-ink-faint hover:text-engagement-accent">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Portfolio
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-engagement-display text-xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-engagement-ink-faint">
            {project.client_name} · {project.project_code}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {project.can_edit && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit project
            </Button>
          )}
          <StatusBadge status={project.status} />
        </div>
      </div>

      <Card className="p-5">
        {project.description && <p className="mb-5 text-engagement-ink-soft">{project.description}</p>}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {fact("Manager", project.project_manager ?? "—")}
          {fact("Billing", BILLING_LABEL[project.billing_model] ?? project.billing_model)}
          {fact("Currency", project.currency)}
          {fact(
            "Budget",
            project.budget_amount != null ? `${project.currency} ${project.budget_amount.toFixed(2)}` : "—",
          )}
          {fact(
            "Timeline",
            `${project.start_date ? format(parseISO(project.start_date), "MMM d, yyyy") : "—"} → ${
              project.end_date ? format(parseISO(project.end_date), "MMM d, yyyy") : "open"
            }`,
          )}
        </dl>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-engagement-line px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="font-medium">Tasks</h2>
            <div className="inline-flex rounded-full border border-engagement-line bg-engagement-canvas p-0.5 text-xs font-medium">
              <button
                onClick={() => setTaskFilter("mine")}
                className={clsx(
                  "rounded-full px-3 py-1 transition-colors",
                  taskFilter === "mine" ? "bg-white text-engagement-ink shadow-sm" : "text-engagement-ink-faint",
                )}
              >
                My tasks
              </button>
              <button
                onClick={() => setTaskFilter("all")}
                className={clsx(
                  "rounded-full px-3 py-1 transition-colors",
                  taskFilter === "all" ? "bg-white text-engagement-ink shadow-sm" : "text-engagement-ink-faint",
                )}
              >
                All
              </button>
            </div>
          </div>
          {project.can_add_tasks && (
            <button
              onClick={() => setTaskForm("new")}
              className="inline-flex items-center gap-1 text-sm font-medium text-engagement-accent hover:text-engagement-accent-hover"
            >
              <Plus className="h-4 w-4" aria-hidden /> New task
            </button>
          )}
        </div>
        {visibleTasks.length === 0 ? (
          <EmptyState
            title={taskFilter === "mine" ? "No tasks assigned to you yet" : "No tasks on this project yet"}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
                <th className="px-5 py-2.5 font-medium">Task</th>
                <th className="px-5 py-2.5 font-medium">Assignee</th>
                <th className="px-5 py-2.5 font-medium">Priority</th>
                <th className="px-5 py-2.5 font-medium">Billable</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((t) => (
                <tr key={t.id} className="border-b border-engagement-line last:border-b-0">
                  <td className="px-5 py-3">
                    <p className="font-medium">{t.name}</p>
                    {t.creator_name && (
                      <p className="mt-0.5 text-xs text-engagement-ink-faint">Added by {t.creator_name}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">{t.assignee ?? "Unassigned"}</td>
                  <td className="px-5 py-3 capitalize">{t.priority}</td>
                  <td className="px-5 py-3">{t.billable ? "Yes" : "No"}</td>
                  <td className="px-5 py-3">
                    {t.can_set_status ? (
                      <select
                        value={t.status}
                        onChange={(e) => updateTaskStatus(t.id, e.target.value)}
                        aria-label={`Status for ${t.name}`}
                        className={clsx(
                          "rounded-full border-0 py-1 pl-2.5 pr-6 text-xs font-medium outline-none focus:ring-2 focus:ring-engagement-accent-ring",
                          t.status === "completed"
                            ? "bg-engagement-ok-soft text-engagement-ok"
                            : "bg-engagement-warn-soft text-engagement-warn",
                        )}
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                      </select>
                    ) : (
                      <StatusBadge status={t.status} />
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {t.can_edit && (
                      <button
                        onClick={() => setTaskForm(t)}
                        aria-label={`Edit ${t.name}`}
                        className="rounded p-1.5 text-engagement-ink-faint hover:bg-engagement-line/60 hover:text-engagement-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-engagement-line px-5 py-3">
          <h2 className="font-medium">Members</h2>
          {project.can_edit && <AddMemberRow projectId={project.id} onAdded={load} />}
        </div>
        {project.members.length === 0 ? (
          <EmptyState title="No members on this project yet" />
        ) : (
          <table className="w-full">
            <tbody>
              {project.members.map((m) => {
                const { done, total } = taskCountFor(m.id);
                return (
                <tr key={m.id} className="border-b border-engagement-line last:border-b-0">
                  <td className="px-5 py-3">
                    <p className="font-medium">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-xs text-engagement-ink-faint">{m.job_title ?? m.employee_code}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-engagement-ink-faint">
                    {total > 0 ? `${done}/${total} tasks done` : "No tasks assigned"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {project.can_edit && (
                      <button
                        onClick={() => removeMember(m.id, `${m.first_name} ${m.last_name}`)}
                        aria-label={`Remove ${m.first_name} ${m.last_name}`}
                        className="rounded p-1.5 text-engagement-ink-faint hover:bg-engagement-bad-soft hover:text-engagement-bad"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <ProjectForm
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}

      {taskForm && (
        <TaskForm
          projectId={project.id}
          task={taskForm === "new" ? null : taskForm}
          members={project.members}
          onClose={() => setTaskForm(null)}
          onSaved={() => {
            setTaskForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}
