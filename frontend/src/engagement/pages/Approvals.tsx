import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { ApprovalInboxItem } from "../api/types";
import { Card, Loading, ErrorState, PageTitle, EmptyState } from "../components/ui";
import { fmtMinutes } from "../utils/time";

export default function Approvals() {
  const [items, setItems] = useState<ApprovalInboxItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<{ data: ApprovalInboxItem[] }>("/approvals/inbox")
      .then((r) => setItems(r.data.data))
      .catch((e) => setError(apiErrorMessage(e, "The approvals inbox could not be loaded")));
  };
  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Loading label="Loading approvals" />;

  return (
    <div>
      <PageTitle
        title="Approvals"
        sub={items.length === 0 ? "Nothing waiting on you" : `${items.length} timesheet${items.length === 1 ? "" : "s"} awaiting review`}
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState
            title="Inbox zero"
            hint="Submitted timesheets from your direct reports will show up here."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-engagement-line text-left text-xs uppercase tracking-wide text-engagement-ink-faint">
                <th className="px-5 py-3 font-medium">Associate</th>
                <th className="px-5 py-3 font-medium">Week</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Billable</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-engagement-line last:border-b-0 hover:bg-engagement-canvas/60">
                  <td className="px-5 py-3">
                    <p className="font-medium">
                      {it.first_name} {it.last_name}
                    </p>
                    <p className="text-xs text-engagement-ink-faint">{it.job_title ?? it.employee_code}</p>
                  </td>
                  <td className="px-5 py-3">
                    {format(parseISO(it.week_start_date), "MMM d")} –{" "}
                    {format(parseISO(it.week_end_date), "MMM d, yyyy")}
                  </td>
                  <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {it.total_minutes < it.capacity_minutes && (
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-engagement-warn"
                          aria-label={`Only ${fmtMinutes(it.total_minutes)} of ${fmtMinutes(it.capacity_minutes)} logged`}
                        />
                      )}
                      {fmtMinutes(it.total_minutes)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-engagement-mono tabular-nums">{fmtMinutes(it.billable_minutes)}</td>
                  <td className="px-5 py-3 text-engagement-ink-faint">
                    {format(parseISO(it.submitted_at), "MMM d, HH:mm")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/engagement/approvals/${it.id}`} className="font-medium text-engagement-accent hover:text-engagement-accent-hover">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
