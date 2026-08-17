import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Pencil, Search, X } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { ProjectTask, RowOptionProject } from "../api/types";
import { Button, Loading, ErrorState } from "./ui";
import { TaskForm } from "./TaskForm";

export interface NewRow {
  project_id: string;
  project_name: string;
  client_name: string;
  task_id: string | null;
  task_name: string | null;
  billable: boolean;
}

export function AddRowModal({
  existingKeys,
  onAdd,
  onClose,
}: {
  existingKeys: Set<string>;
  onAdd: (row: NewRow) => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<RowOptionProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [filter, setFilter] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [editingTask, setEditingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [savingNewTask, setSavingNewTask] = useState(false);
  const [taskComboOpen, setTaskComboOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const comboInputRef = useRef<HTMLInputElement>(null);
  const taskComboRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: RowOptionProject[] }>("/portfolio/time-row-options")
      .then((r) => setOptions(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "Projects could not be loaded")));
  };
  useEffect(load, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!comboOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [comboOpen]);

  useEffect(() => {
    if (!taskComboOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (taskComboRef.current && !taskComboRef.current.contains(e.target as Node)) setTaskComboOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [taskComboOpen]);

  const project = options?.find((p) => String(p.project_id) === projectId) ?? null;
  const selectedLabel = project ? `${project.client_name} / ${project.project_name}` : "";
  // Once a project is picked, the input just displays its label — only treat
  // the field as an active search once the text diverges from that label.
  const isSearching = filter !== selectedLabel;

  const filtered = useMemo(() => {
    if (!options) return [];
    if (!isSearching) return options;
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (p) => p.project_name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q),
    );
  }, [options, filter, isSearching]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered]);

  const selectProject = (p: RowOptionProject) => {
    setProjectId(String(p.project_id));
    setFilter(`${p.client_name} / ${p.project_name}`);
    setTaskId("");
    setComboOpen(false);
    setNewTaskName("");
    setTaskComboOpen(false);
  };

  const addNewTask = async () => {
    if (!project || !newTaskName.trim()) return;
    setSavingNewTask(true);
    setError(null);
    try {
      const r = await api.post<{ data: ProjectTask }>(`/portfolio/projects/${project.project_id}/tasks`, {
        name: newTaskName.trim(),
      });
      setTaskId(r.data.data.id);
      setNewTaskName("");
      load();
    } catch (e) {
      setError(apiErrorMessage(e, "The task could not be created"));
    } finally {
      setSavingNewTask(false);
    }
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setComboOpen(true);
    if (projectId && value !== selectedLabel) {
      setProjectId("");
      setTaskId("");
      setNewTaskName("");
    }
  };

  const handleComboKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (comboOpen) {
        e.stopPropagation();
        setComboOpen(false);
      }
      return;
    }
    if (!comboOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = filtered[highlightedIndex];
      if (p) selectProject(p);
    }
  };
  const selectedTask = project?.tasks.find((t) => String(t.task_id) === taskId) ?? null;
  const selectedTaskAsProjectTask: ProjectTask | null = selectedTask
    ? {
        id: String(selectedTask.task_id),
        name: selectedTask.task_name,
        description: selectedTask.description,
        status: selectedTask.status,
        priority: selectedTask.priority,
        billable: selectedTask.billable,
        assigned_to: selectedTask.assigned_to,
        assignee: selectedTask.assignee,
        created_by: null,
        creator_name: null,
        can_edit: selectedTask.can_edit,
      }
    : null;

  const submit = () => {
    if (!project) return;
    const task = project.tasks.find((t) => String(t.task_id) === taskId) ?? null;
    const key = `${project.project_id}|${task ? task.task_id : ""}`;
    if (existingKeys.has(key)) {
      setError("That project and task row is already on this week");
      return;
    }
    onAdd({
      project_id: String(project.project_id),
      project_name: project.project_name,
      client_name: project.client_name,
      task_id: task ? String(task.task_id) : null,
      task_name: task ? task.task_name : null,
      billable: project.billing_model !== "non_billable" && (task ? task.billable : true),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-engagement-ink/40 p-4 pt-24"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-row-title"
    >
      <div ref={dialogRef} className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-engagement-line px-6 py-5">
          <h2 id="add-row-title" className="font-engagement-display text-lg font-semibold">
            Add time row
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-engagement-ink-faint hover:bg-engagement-line/60">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`flex-1 space-y-5 overflow-y-auto px-6 py-6 ${
            comboOpen || taskComboOpen ? "min-h-[440px]" : "min-h-0"
          }`}
        >
          {options === null && !error && <Loading label="Loading projects" />}
          {error && <ErrorState message={error} onRetry={options === null ? load : undefined} />}
          {options !== null && (
            <>
              <div ref={comboRef} className="relative">
                <label htmlFor="row-project-search" className="mb-1.5 block text-sm font-medium text-engagement-ink-soft">
                  Project
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-engagement-ink-faint"
                    aria-hidden
                  />
                  <input
                    id="row-project-search"
                    ref={comboInputRef}
                    autoFocus
                    role="combobox"
                    aria-expanded={comboOpen}
                    aria-controls="row-project-listbox"
                    aria-autocomplete="list"
                    autoComplete="off"
                    value={filter}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={handleComboKeyDown}
                    placeholder="Search by project or client"
                    className="h-11 w-full rounded-xl border border-engagement-line pl-9 pr-9 text-sm outline-none transition-colors focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setComboOpen((o) => !o);
                      comboInputRef.current?.focus();
                    }}
                    aria-label={comboOpen ? "Hide project list" : "Show all projects"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-engagement-ink-faint hover:text-engagement-ink-soft"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${comboOpen ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                </div>
                {comboOpen && (
                  <ul
                    id="row-project-listbox"
                    role="listbox"
                    className="absolute z-10 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-engagement-line bg-white py-1.5 shadow-lg"
                  >
                    {filtered.length === 0 ? (
                      <li className="px-3.5 py-2.5 text-sm text-engagement-ink-faint">No projects match "{filter}"</li>
                    ) : (
                      filtered.map((p, i) => (
                        <li key={String(p.project_id)} role="option" aria-selected={String(p.project_id) === projectId}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectProject(p)}
                            className={`block w-full px-3.5 py-2 text-left text-sm ${
                              i === highlightedIndex ? "bg-engagement-accent-ring/40" : "hover:bg-engagement-accent-ring/40"
                            } ${String(p.project_id) === projectId ? "font-medium text-engagement-accent" : "text-engagement-ink"}`}
                          >
                            {p.client_name} / {p.project_name}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              {project && (project.tasks.length > 0 || project.can_add_tasks) && (
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="row-task" className="block text-sm font-medium text-engagement-ink-soft">
                        Task
                      </label>
                      {selectedTask?.can_edit && (
                        <button
                          type="button"
                          onClick={() => setEditingTask(true)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-engagement-accent hover:text-engagement-accent-hover"
                        >
                          <Pencil className="h-3 w-3" aria-hidden /> Edit task
                        </button>
                      )}
                    </div>
                    {project.tasks.length > 0 ? (
                      <div ref={taskComboRef} className="relative">
                        <button
                          type="button"
                          id="row-task"
                          onClick={() => setTaskComboOpen((o) => !o)}
                          aria-haspopup="listbox"
                          aria-expanded={taskComboOpen}
                          className="flex h-11 w-full items-center justify-between rounded-xl border border-engagement-line bg-white px-3.5 text-left text-sm outline-none transition-colors focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                        >
                          <span className={taskId ? "text-engagement-ink" : "text-engagement-ink-faint"}>
                            {taskId
                              ? project.tasks.find((t) => String(t.task_id) === taskId)?.task_name
                              : "No specific task"}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-engagement-ink-faint transition-transform ${taskComboOpen ? "rotate-180" : ""}`}
                            aria-hidden
                          />
                        </button>
                        {taskComboOpen && (
                          <ul
                            role="listbox"
                            className="absolute z-10 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-engagement-line bg-white py-1.5 shadow-lg"
                          >
                            <li role="option" aria-selected={taskId === ""}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setTaskId("");
                                  setTaskComboOpen(false);
                                }}
                                className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-engagement-accent-ring/40 ${
                                  taskId === "" ? "font-medium text-engagement-accent" : "text-engagement-ink"
                                }`}
                              >
                                No specific task
                              </button>
                            </li>
                            {project.tasks.map((t) => (
                              <li key={String(t.task_id)} role="option" aria-selected={String(t.task_id) === taskId}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setTaskId(String(t.task_id));
                                    setTaskComboOpen(false);
                                  }}
                                  className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-engagement-accent-ring/40 ${
                                    String(t.task_id) === taskId ? "font-medium text-engagement-accent" : "text-engagement-ink"
                                  }`}
                                >
                                  {t.task_name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      !project.can_add_tasks && (
                        <p className="text-sm text-engagement-ink-faint">No tasks on this project yet.</p>
                      )
                    )}
                  </div>

                  {project.can_add_tasks && taskId === "" && (
                    <div>
                      <label htmlFor="row-new-task" className="mb-1.5 block text-sm font-medium text-engagement-ink-soft">
                        New task
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="row-new-task"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addNewTask();
                            }
                          }}
                          placeholder="Type a name to add a new task"
                          className="h-11 flex-1 rounded-xl border border-engagement-line px-3.5 text-sm outline-none transition-colors focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                        />
                        <Button onClick={addNewTask} busy={savingNewTask} disabled={!newTaskName.trim()}>
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-engagement-line px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!projectId}>
            Add row
          </Button>
        </div>
      </div>

      {editingTask && project && selectedTaskAsProjectTask && (
        <TaskForm
          projectId={String(project.project_id)}
          task={selectedTaskAsProjectTask}
          onClose={() => setEditingTask(false)}
          onSaved={() => {
            setEditingTask(false);
            load();
          }}
        />
      )}
    </div>
  );
}
