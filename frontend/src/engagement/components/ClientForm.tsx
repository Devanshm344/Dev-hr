import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { Client } from "../api/types";
import { Button, Loading, ErrorState } from "./ui";

function suggestNextCode(clients: Client[]): string {
  const max = clients.reduce((m, c) => {
    const match = /^CL-(\d+)$/.exec(c.client_code);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `CL-${String(max + 1).padStart(3, "0")}`;
}

export function ClientForm({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved: (saved: Client) => void;
}) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [clientCode, setClientCode] = useState(client?.client_code ?? "");
  const [name, setName] = useState(client?.name ?? "");
  const [currency, setCurrency] = useState(client?.currency ?? "INR");
  const [status, setStatus] = useState(client?.status ?? "active");
  const [notes, setNotes] = useState(client?.notes ?? "");

  useEffect(() => {
    api
      .get<{ data: Client[] }>("/portfolio/clients")
      .then((r) => {
        setClients(r.data.data);
        if (!client) setClientCode((v) => v || suggestNextCode(r.data.data));
      })
      .catch((e) => setError(apiErrorMessage(e, "Clients could not be loaded")));
  }, [client]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!clientCode.trim() || !name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    const body = { client_code: clientCode.trim(), name: name.trim(), currency, status, notes: notes || undefined };
    setSaving(true);
    try {
      let saved: Client;
      if (client) {
        const r = await api.put<{ data: Client }>(`/portfolio/clients/${client.id}`, body);
        saved = r.data.data;
        toast.success("Client updated");
      } else {
        const r = await api.post<{ data: Client }>("/portfolio/clients", body);
        saved = r.data.data;
        toast.success("Client created");
      }
      onSaved(saved);
    } catch (e) {
      toast.error(apiErrorMessage(e, "The client could not be saved"));
    } finally {
      setSaving(false);
    }
  };

  const loaded = clients !== null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-engagement-ink/40 p-4 pt-24 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-form-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-engagement-line px-5 py-4">
          <h2 id="client-form-title" className="font-engagement-display text-base font-semibold">
            {client ? "Edit client" : "New client"}
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
                  <label htmlFor="cl-code" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Code
                  </label>
                  <input
                    id="cl-code"
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value.toUpperCase())}
                    className="h-9 w-full rounded-md border border-engagement-line px-3 font-engagement-mono outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="cl-name" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Name
                  </label>
                  <input
                    id="cl-name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line px-3 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cl-currency" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Currency
                  </label>
                  <input
                    id="cl-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="h-9 w-full rounded-md border border-engagement-line px-3 font-engagement-mono outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
                <div>
                  <label htmlFor="cl-status" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Status
                  </label>
                  <select
                    id="cl-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="cl-notes" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Notes
                </label>
                <textarea
                  id="cl-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-engagement-line px-3 py-2 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                />
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
