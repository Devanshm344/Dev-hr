import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import type { ApprovalDetail as ApprovalDetailType } from "../api/types";
import { Button, Card, Loading, ErrorState, StatusBadge, EmptyState } from "../components/ui";
import { fmtMinutes } from "../utils/time";

type DecisionMode = "approve" | "request_changes" | null;

export default function ApprovalDetail() {
  const { timesheetId } = useParams<{ timesheetId: string }>();
  const [detail, setDetail] = useState<ApprovalDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DecisionMode>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    api
      .get<{ data: ApprovalDetailType }>(`/approvals/${timesheetId}`)
      .then((r) => setDetail(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "This timesheet could not be loaded")));
  };
  useEffect(load, [timesheetId]);

  const submitDecision = async () => {
    if (!mode) return;
    if (mode === "request_changes" && !comment.trim()) {
      toast.error("A comment is required when requesting changes");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/approvals/${timesheetId}/decision`, { action: mode, comment: comment.trim() || undefined });
      toast.success(mode === "approve" ? "Timesheet approved" : "Changes requested");
      setMode(null);
      setComment("");
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "The decision could not be saved"));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <Loading label="Loading timesheet" />;

  const ws = parseISO(detail.timesheet.week_start_date);
  const we = parseISO(detail.timesheet.week_end_date);
  const canDecide = detail.timesheet.status === "submitted";
  const missingDayNames = detail.missing_working_days.map((d) => format(parseISO(d), "EEEE"));

  return (
    <div>
      <Link to="/engagement/approvals" className="mb-4 inline-flex items-center gap-1 text-sm text-engagement-ink-faint hover:text-engagement-accent">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to approvals
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-engagement-display text-lg font-semibold tracking-tight">
            {detail.employee.name} <span className="text-engagement-ink-faint">·</span> {format(ws, "MMM d")} – {format(we, "MMM d, yyyy")}
          </h1>
          <p className="mt-1 text-engagement-ink-faint">{detail.employee.job_title ?? detail.employee.employee_code}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={detail.timesheet.status} />
          {canDecide && (
            <>
              <Button variant="secondary" onClick={() => setMode("request_changes")}>
                Request changes
              </Button>
              <Button
                onClick={() => setMode("approve")}
                disabled={missingDayNames.length > 0}
                title={missingDayNames.length > 0 ? `Missing hours on ${missingDayNames.join(", ")}` : undefined}
              >
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {missingDayNames.length > 0 ? (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-engagement-bad-soft px-4 py-2.5 text-engagement-bad">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Missing hours on {missingDayNames.join(", ")} — request changes instead of approving.
        </p>
      ) : (
        detail.total_minutes < detail.capacity_minutes && (
          <p className="mb-4 flex items-center gap-2 rounded-md bg-engagement-warn-soft px-4 py-2.5 text-engagement-warn">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Only {fmtMinutes(detail.total_minutes)} of {fmtMinutes(detail.capacity_minutes)} logged this week.
          </p>
        )
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-engagement-line text-xs uppercase tracking-wide text-engagement-ink-faint">
              <th className="w-64 px-4 py-3 text-left font-medium">Project / Task</th>
              {detail.days.map((d) => (
                <th key={d} className="px-2 py-3 text-center font-medium">
                  <span>{format(parseISO(d), "EEE")}</span>
                  <span className="block font-engagement-mono text-[11px] font-normal tabular-nums text-engagement-ink-faint">
                    {format(parseISO(d), "dd/MM")}
                  </span>
                </th>
              ))}
              <th className="w-24 px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState title="No time rows" hint="Nothing was logged on this timesheet." />
                </td>
              </tr>
            )}
            {detail.rows.map((row) => (
              <tr key={`${row.project_id}|${row.task_id ?? ""}`} className="border-b border-engagement-line last:border-b-0">
                <td className="px-4 py-2.5">
                  <p className="font-medium">
                    {row.client_name} <span className="text-engagement-ink-faint">/</span> {row.project_name}
                  </p>
                  <p className="text-xs text-engagement-ink-faint">
                    {row.task_name ?? "No specific task"}
                    {!row.billable && <span className="ml-2 rounded bg-engagement-line/70 px-1.5 py-px text-[10px]">Non-billable</span>}
                  </p>
                </td>
                {detail.days.map((d) => {
                  const entry = row.entries[d];
                  return (
                    <td key={d} className="px-2 py-2 text-center">
                      <span className="font-engagement-mono text-sm tabular-nums text-engagement-ink-soft" title={entry?.note ?? undefined}>
                        {entry ? fmtMinutes(entry.minutes) : "·"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-engagement-mono text-sm font-medium tabular-nums">
                  {fmtMinutes(row.total_minutes)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-engagement-canvas/60">
              <td className="px-4 py-3 text-engagement-ink-faint">Total</td>
              {detail.days.map((d) => (
                <td key={d} className="px-2 py-3 text-center font-engagement-mono text-sm font-medium tabular-nums">
                  {detail.day_totals[d] ? fmtMinutes(detail.day_totals[d]) : "·"}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-engagement-mono text-sm font-semibold tabular-nums text-engagement-accent">
                {fmtMinutes(detail.total_minutes)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <p className="mt-3 text-xs text-engagement-ink-faint">
        Billable: <span className="font-engagement-mono tabular-nums">{fmtMinutes(detail.billable_minutes)}</span> · Hover a cell to see its note.
      </p>

      <Card className="mt-6">
        <div className="border-b border-engagement-line px-5 py-3">
          <h2 className="font-medium">Review history</h2>
        </div>
        {detail.reviews.length === 0 ? (
          <EmptyState title="No reviews yet" hint="This week has not been reviewed." />
        ) : (
          <ul className="divide-y divide-engagement-line">
            {detail.reviews.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {r.reviewer_name} <StatusBadge status={r.action} />
                  </span>
                  <span className="text-xs text-engagement-ink-faint">{format(parseISO(r.created_at), "MMM d, HH:mm")}</span>
                </div>
                {r.comment && <p className="mt-1 text-engagement-ink-soft">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {mode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-engagement-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="font-engagement-display text-base font-semibold">
              {mode === "approve" ? "Approve this week?" : "Request changes"}
            </h2>
            <p className="mt-2 text-engagement-ink-soft">
              {mode === "approve"
                ? "The associate will see this week marked approved and it can no longer be edited."
                : "The associate will see your comment and can edit this week again."}
            </p>
            <label className="mt-4 block text-sm font-medium">
              Comment {mode === "request_changes" && <span className="text-engagement-bad">*</span>}
              <textarea
                className="mt-1 w-full rounded-md border border-engagement-line px-3 py-2 text-sm focus:border-engagement-accent focus:outline-none"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={mode === "approve" ? "Optional note" : "What needs to change?"}
                autoFocus
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button onClick={submitDecision} busy={busy}>
                {mode === "approve" ? "Approve" : "Request changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
