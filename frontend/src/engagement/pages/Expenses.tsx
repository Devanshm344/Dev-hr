import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { Expense } from "../api/types";
import { useEngagementUser } from "../api/context";
import { Button, Card, Loading, ErrorState, PageTitle, StatusBadge, EmptyState } from "../components/ui";
import { ExpenseForm } from "../components/ExpenseForm";

const EDITABLE = new Set(["draft", "rejected"]);

function fmtAmount(e: Expense) {
  return `${e.currency} ${e.amount.toFixed(2)}`;
}

function MyExpenses() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<Expense | "new" | null>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: Expense[] }>("/expenses/my")
      .then((r) => setExpenses(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "Your expenses could not be loaded")));
  };
  useEffect(load, []);

  const submit = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/submit`);
      toast.success("Expense submitted");
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The expense could not be submitted"));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await api.delete(`/expenses/${id}`);
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The expense could not be deleted"));
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!expenses) return <Loading label="Loading your expenses" />;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setFormFor("new")}>New expense</Button>
      </div>
      {expenses.length === 0 ? (
        <Card>
          <EmptyState title="No expenses yet" hint="Log your first expense with New expense above." />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
                  <td className="px-5 py-3">{format(parseISO(e.expense_date), "MMM d, yyyy")}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium">{e.project_name}</p>
                    <p className="text-xs text-engagement-ink-faint">{e.client_name}</p>
                  </td>
                  <td className="px-5 py-3">
                    {e.category_name}
                    {!e.billable && <span className="ml-2 rounded bg-engagement-line/70 px-1.5 py-px text-[10px]">Non-billable</span>}
                    {e.other_category_note && (
                      <p className="mt-0.5 text-xs text-engagement-ink-faint">{e.other_category_note}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtAmount(e)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={e.status} />
                    {e.status === "rejected" && e.review_comment && (
                      <p className="mt-1 max-w-[220px] text-xs text-engagement-bad">{e.review_comment}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {EDITABLE.has(e.status) && (
                      <>
                        <button onClick={() => setFormFor(e)} className="mr-3 font-medium text-engagement-accent hover:text-engagement-accent-hover">
                          Edit
                        </button>
                        <button onClick={() => submit(e.id)} className="mr-3 font-medium text-engagement-accent hover:text-engagement-accent-hover">
                          Submit
                        </button>
                        <button onClick={() => remove(e.id)} className="font-medium text-engagement-bad hover:text-red-800">
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {formFor && (
        <ExpenseForm
          expense={formFor === "new" ? null : formFor}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Review() {
  const [items, setItems] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: Expense[] }>("/expenses/inbox")
      .then((r) => setItems(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "The expense inbox could not be loaded")));
  };
  useEffect(load, []);

  const decide = async (id: string, action: "approve" | "reject") => {
    let comment: string | undefined;
    if (action === "reject") {
      const entered = window.prompt("Reason for rejecting this expense (required):");
      if (entered === null) return;
      if (!entered.trim()) {
        toast.error("A comment is required when rejecting");
        return;
      }
      comment = entered.trim();
    }
    setBusyId(id);
    try {
      await api.post(`/expenses/${id}/decision`, { action, comment });
      toast.success(action === "approve" ? "Expense approved" : "Expense rejected");
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The decision could not be saved"));
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Loading label="Loading the expense inbox" />;

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title="Inbox zero" hint="Submitted expenses from your direct reports will show up here." />
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
            <th className="px-5 py-3 font-medium">Associate</th>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Project</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
            <th className="px-5 py-3 font-medium">Description</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
              <td className="px-5 py-3">
                <p className="font-medium">{e.user_name}</p>
                <p className="text-xs text-engagement-ink-faint">{e.employee_code}</p>
              </td>
              <td className="px-5 py-3">{format(parseISO(e.expense_date), "MMM d, yyyy")}</td>
              <td className="px-5 py-3">
                {e.client_name} <span className="text-engagement-ink-faint">/</span> {e.project_name}
              </td>
              <td className="px-5 py-3">
                {e.category_name}
                {e.other_category_note && <p className="mt-0.5 text-xs text-engagement-ink-faint">{e.other_category_note}</p>}
              </td>
              <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtAmount(e)}</td>
              <td className="px-5 py-3 text-engagement-ink-faint">{e.description ?? "—"}</td>
              <td className="px-5 py-3 text-right whitespace-nowrap">
                <button
                  disabled={busyId === e.id}
                  onClick={() => decide(e.id, "approve")}
                  className="mr-3 font-medium text-engagement-ok hover:text-emerald-800 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busyId === e.id}
                  onClick={() => decide(e.id, "reject")}
                  className="font-medium text-engagement-bad hover:text-red-800 disabled:opacity-50"
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function Expenses() {
  const user = useEngagementUser();
  const canReview = user.role === "manager" || user.role === "admin";
  const [tab, setTab] = useState<"mine" | "review">("mine");

  return (
    <div>
      <PageTitle
        title="Expenses"
        sub="Log and track project expenses"
        actions={
          canReview && (
            <div className="flex rounded-md border border-engagement-line bg-white p-0.5">
              <button
                onClick={() => setTab("mine")}
                className={clsx(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === "mine" ? "bg-engagement-accent text-white" : "text-engagement-ink-soft hover:text-engagement-ink",
                )}
              >
                My expenses
              </button>
              <button
                onClick={() => setTab("review")}
                className={clsx(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === "review" ? "bg-engagement-accent text-white" : "text-engagement-ink-soft hover:text-engagement-ink",
                )}
              >
                Review
              </button>
            </div>
          )
        }
      />
      {tab === "mine" || !canReview ? <MyExpenses /> : <Review />}
    </div>
  );
}
