import { useState } from "react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../api/client";
import { Button } from "./ui";

export function WeekendReasonModal({
  timesheetId,
  date,
  onClose,
  onLogged,
}: {
  timesheetId: string;
  date: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/time/weekend-entries", { timesheet_id: timesheetId, work_date: date, reason: reason.trim() });
      toast.success("Reason logged — you can now log hours for this day");
      onLogged();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "The reason could not be logged"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-engagement-ink/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="font-engagement-display text-base font-semibold">
          Reason for working {format(parseISO(date), "EEEE, MMM d")}
        </h2>
        <p className="mt-2 text-engagement-ink-soft">
          This is your weekend — logging a reason unlocks the day for you right away and lets your manager
          know why.
        </p>
        <textarea
          autoFocus
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Covering a client release window"
          maxLength={1000}
          className="mt-3 w-full resize-none rounded-lg border border-engagement-line bg-white px-3 py-2 text-sm text-engagement-ink outline-none transition-colors focus:border-engagement-accent focus:ring-2 focus:ring-engagement-accent-ring"
        />
        {error && <p className="mt-2 text-engagement-bad">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} busy={submitting} disabled={!reason.trim()}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
