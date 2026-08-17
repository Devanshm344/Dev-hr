import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { ProjectMember, ProjectTask } from "../api/types";
import { useEngagementUser } from "../api/context";
import { Button } from "./ui";

export function TaskForm({
  projectId,
  task,
  members,
  onClose,
  onSaved,
}: {
  projectId: string;
  task: ProjectTask | null;
  members: ProjectMember[];
  onClose: () => void;
  onSaved: (saved: ProjectTask) => void;
}) {
  const user = useEngagementUser();
  const canAssign = user.role !== "employee";

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? "");
  const [status, setStatus] = useState(task?.status ?? "pending");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [billable, setBillable] = useState(task?.billable ?? true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const body = {
      name: name.trim(),
      description: description || undefined,
      assigned_to: assignedTo || undefined,
      status,
      priority,
      billable,
    };
    setSaving(true);
    try {
      let saved: ProjectTask;
      if (task) {
        const r = await api.put<{ data: ProjectTask }>(`/portfolio/tasks/${task.id}`, body);
        saved = r.data.data;
        toast.success("Task updated");
      } else {
        const r = await api.post<{ data: ProjectTask }>(`/portfolio/projects/${projectId}/tasks`, body);
        saved = r.data.data;
        toast.success("Task created");
      }
      onSaved(saved);
    } catch (e) {
      toast.error(apiErrorMessage(e, "The task could not be saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-engagement-ink/40 p-4 pt-24 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-form-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-engagement-line px-5 py-4">
          <h2 id="task-form-title" className="font-engagement-display text-base font-semibold">
            {task ? "Edit task" : "New task"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-engagement-ink-faint hover:bg-engagement-line/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="tk-name" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
              Name
            </label>
            <input
              id="tk-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-engagement-line px-3 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
            />
          </div>
              <div>
                <label htmlFor="tk-desc" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Description
                </label>
                <textarea
                  id="tk-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-engagement-line px-3 py-2 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                />
              </div>
              {canAssign && (
                <div>
                  <label htmlFor="tk-assignee" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Assignee
                  </label>
                  <select
                    id="tk-assignee"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                  >
                    <option value="">Unassigned</option>
                    {members.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tk-status" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Status
                  </label>
                  <select
                    id="tk-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="tk-priority" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Priority
                  </label>
                  <select
                    id="tk-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-engagement-ink-soft">
                <input
                  type="checkbox"
                  checked={billable}
                  onChange={(e) => setBillable(e.target.checked)}
                  className="h-4 w-4 rounded border-engagement-line text-engagement-accent focus:ring-engagement-accent-ring"
                />
                Billable
              </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-engagement-line px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} busy={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
