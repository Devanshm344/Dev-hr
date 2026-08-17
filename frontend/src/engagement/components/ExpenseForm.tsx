import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { Expense, ExpenseCategory, RowOptionProject } from "../api/types";
import { Button, Loading, ErrorState } from "./ui";

export function ExpenseForm({
  expense,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projects, setProjects] = useState<RowOptionProject[] | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [projectId, setProjectId] = useState(expense?.project_id ?? "");
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? "");
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState(expense?.currency ?? "INR");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [billable, setBillable] = useState(expense?.billable ?? true);
  const [receiptNote, setReceiptNote] = useState(expense?.receipt_note ?? "");
  const [otherCategoryNote, setOtherCategoryNote] = useState(expense?.other_category_note ?? "");

  const selectedCategory = categories?.find((c) => c.id === categoryId) ?? null;
  const isOtherCategory = selectedCategory?.name.toLowerCase() === "other";

  useEffect(() => {
    Promise.all([
      api.get<{ data: RowOptionProject[] }>("/portfolio/time-row-options"),
      api.get<{ data: ExpenseCategory[] }>("/expenses/categories"),
    ])
      .then(([p, c]) => {
        setProjects(p.data.data);
        setCategories(c.data.data);
        if (!expense) {
          if (p.data.data[0]) setProjectId((v) => v || String(p.data.data[0].project_id));
          if (c.data.data[0]) setCategoryId((v) => v || c.data.data[0].id);
        }
      })
      .catch((e) => setError(apiErrorMessage(e, "Projects and categories could not be loaded")));
  }, [expense]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!projectId || !categoryId || !expenseDate || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Fill in project, category, date, and a positive amount");
      return;
    }
    if (isOtherCategory && !otherCategoryNote.trim()) {
      toast.error("Describe what this 'Other' expense category is");
      return;
    }
    const body = {
      project_id: projectId,
      category_id: categoryId,
      expense_date: expenseDate,
      amount: amt,
      currency,
      description: description || undefined,
      billable,
      receipt_note: receiptNote || undefined,
      other_category_note: isOtherCategory ? otherCategoryNote.trim() : undefined,
    };
    setSaving(true);
    try {
      if (expense) {
        await api.put(`/expenses/${expense.id}`, body);
        toast.success("Expense updated");
      } else {
        await api.post("/expenses", body);
        toast.success("Expense saved as draft");
      }
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The expense could not be saved"));
    } finally {
      setSaving(false);
    }
  };

  const loaded = projects !== null && categories !== null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-engagement-ink/40 p-4 pt-16 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-form-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-engagement-line px-5 py-4">
          <h2 id="expense-form-title" className="font-engagement-display text-base font-semibold">
            {expense ? "Edit expense" : "New expense"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-engagement-ink-faint hover:bg-engagement-line/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!loaded && !error && <Loading label="Loading form" />}
          {error && <ErrorState message={error} />}
          {loaded && (
            <>
              <div>
                <label htmlFor="exp-project" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Project
                </label>
                <select
                  id="exp-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                >
                  <option value="">Choose a project…</option>
                  {projects!.map((p) => (
                    <option key={String(p.project_id)} value={String(p.project_id)}>
                      {p.client_name} / {p.project_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="exp-category" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Category
                </label>
                <select
                  id="exp-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-9 w-full rounded-md border border-engagement-line bg-white px-2 outline-none focus:border-engagement-accent"
                >
                  <option value="">Choose a category…</option>
                  {categories!.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {isOtherCategory && (
                <div>
                  <label htmlFor="exp-other-category" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    What kind of expense is this?
                  </label>
                  <input
                    id="exp-other-category"
                    autoFocus
                    value={otherCategoryNote}
                    onChange={(e) => setOtherCategoryNote(e.target.value)}
                    placeholder="e.g. Conference registration fee"
                    className="h-9 w-full rounded-md border border-engagement-line px-3 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="exp-date" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Date
                  </label>
                  <input
                    id="exp-date"
                    type="date"
                    value={expenseDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="h-9 w-full rounded-md border border-engagement-line px-2 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
                <div>
                  <label htmlFor="exp-currency" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                    Currency
                  </label>
                  <input
                    id="exp-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="h-9 w-full rounded-md border border-engagement-line px-2 font-engagement-mono outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="exp-amount" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Amount
                </label>
                <input
                  id="exp-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9 w-full rounded-md border border-engagement-line px-3 font-engagement-mono outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                />
              </div>
              <div>
                <label htmlFor="exp-desc" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Description
                </label>
                <input
                  id="exp-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was this for?"
                  className="h-9 w-full rounded-md border border-engagement-line px-3 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                />
              </div>
              <div>
                <label htmlFor="exp-receipt" className="mb-1 block text-xs font-medium text-engagement-ink-soft">
                  Receipt note
                </label>
                <input
                  id="exp-receipt"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="e.g. receipt filed with finance"
                  className="h-9 w-full rounded-md border border-engagement-line px-3 outline-none focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-engagement-ink-soft">
                <input
                  type="checkbox"
                  checked={billable}
                  onChange={(e) => setBillable(e.target.checked)}
                  className="h-4 w-4 rounded border-engagement-line text-engagement-accent focus:ring-engagement-accent-ring"
                />
                Billable to the client
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-engagement-line px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} busy={saving} disabled={!loaded}>
            Save draft
          </Button>
        </div>
      </div>
    </div>
  );
}
