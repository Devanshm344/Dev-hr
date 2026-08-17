"""Scans open timesheets and emails the right reminder for whatever stage
they've reached — see time_service.reminder_stage for the stage rules."""
import logging

from app.engagement.core.email import send_email
from app.engagement.repositories import time_repo
from app.engagement.services import time_service

log = logging.getLogger("em.reminders")

STAGE_COLUMN = {
    "grace": "due_reminder_sent_at",
    "overdue": "overdue_notified_at",
    "escalated": "escalated_at",
}
STAGE_ORDER = ["grace", "overdue", "escalated"]


def run_reminder_sweep(conn) -> int:
    """Send (or log, if SMTP isn't configured) exactly one email per stage per
    timesheet, the first time that stage is observed. Returns how many fired."""
    sent = 0
    for row in time_repo.reminder_candidates(conn):
        due_date = time_service.shift_due_date(row["week_start_date"], row["shift_start_day"])
        stage = time_service.reminder_stage(row["status"], due_date)
        if stage is None:
            continue

        # Backfill any stage we skipped over (e.g. the app was down) without
        # sending a stale email for it — only the current stage gets one.
        for earlier in STAGE_ORDER[: STAGE_ORDER.index(stage)]:
            col = STAGE_COLUMN[earlier]
            if row[col] is None:
                time_repo.mark_reminder_sent(conn, row["id"], col)

        col = STAGE_COLUMN[stage]
        if row[col] is not None:
            continue  # this stage was already handled

        employee_name = f"{row['first_name']} {row['last_name']}"
        week_label = f"{row['week_start_date'].strftime('%b %d')} – {row['week_end_date'].strftime('%b %d')}"

        if stage == "grace":
            send_email(
                row["email"],
                "Timesheet due — please submit soon",
                f"Hi {row['first_name']},\n\n"
                f"Your timesheet for {week_label} was due at the end of your last working day. "
                f"Please submit it soon, before it's marked overdue.\n\n— EM",
            )
        elif stage == "overdue":
            send_email(
                row["email"],
                "Timesheet overdue",
                f"Hi {row['first_name']},\n\n"
                f"Your timesheet for {week_label} is now overdue. Please submit it as soon as "
                f"you can.\n\n— EM",
            )
        else:  # escalated
            send_email(
                row["email"],
                "Timesheet overdue for a week — your manager has been notified",
                f"Hi {row['first_name']},\n\n"
                f"Your timesheet for {week_label} has been overdue for a week and your manager "
                f"has now been notified.\n\n— EM",
            )
            if row["manager_email"]:
                send_email(
                    row["manager_email"],
                    f"{employee_name}'s timesheet is overdue",
                    f"Hi {row['manager_first_name']},\n\n"
                    f"{employee_name}'s timesheet for {week_label} has been overdue for over a "
                    f"week and still hasn't been submitted.\n\n— EM",
                )

        time_repo.mark_reminder_sent(conn, row["id"], col)
        sent += 1

    if sent:
        log.info("reminder sweep sent %d email(s)", sent)
    return sent
