from app.engagement.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationFailedError
from app.engagement.repositories import approvals_repo, notifications_repo, time_repo
from app.engagement.services import time_service

DECISION_ACTIONS = {"approve": "approved", "request_changes": "changes_requested"}


def _authorize_subject(conn, user: dict, ts: dict) -> dict:
    owner = approvals_repo.user_brief(conn, ts["user_id"])
    if owner is None:
        raise NotFoundError("Timesheet not found")
    if user["role"] != "admin" and str(owner["manager_id"]) != str(user["id"]):
        raise ForbiddenError("You can only review your direct reports' timesheets")
    return owner


def get_inbox(conn, user: dict) -> list[dict]:
    items = approvals_repo.inbox(conn, user["id"])
    for item in items:
        item["capacity_minutes"] = int(float(item.pop("weekly_capacity_hours")) * 60)
    return items


def get_report_detail(conn, user: dict, timesheet_id: str) -> dict:
    ts = time_repo.get_timesheet(conn, timesheet_id)
    if ts is None:
        raise NotFoundError("Timesheet not found")
    owner = _authorize_subject(conn, user, ts)

    grid = time_service.build_grid(conn, owner, ts)
    grid["employee"] = {
        "id": owner["id"],
        "name": f"{owner['first_name']} {owner['last_name']}",
        "employee_code": owner["employee_code"],
        "job_title": owner["job_title"],
    }
    grid["reviews"] = approvals_repo.list_reviews(conn, timesheet_id)
    return grid


def decide(conn, user: dict, timesheet_id: str, action: str, comment: str | None) -> dict:
    if action not in DECISION_ACTIONS:
        raise ValidationFailedError("action must be 'approve' or 'request_changes'")

    ts = time_repo.get_timesheet(conn, timesheet_id)
    if ts is None:
        raise NotFoundError("Timesheet not found")
    owner = _authorize_subject(conn, user, ts)

    if ts["status"] != "submitted":
        raise ConflictError(f"A {ts['status']} timesheet cannot be reviewed")
    if action == "request_changes" and not (comment and comment.strip()):
        raise ValidationFailedError("A comment is required when requesting changes")
    if action == "approve":
        entries = time_repo.timesheet_entries(conn, timesheet_id)
        missing = time_service.missing_working_days(entries, ts, owner)
        if missing:
            raise ValidationFailedError(
                "This week is missing hours on " + ", ".join(d.strftime("%A") for d in missing)
                + " — request changes instead of approving"
            )

    new_status = DECISION_ACTIONS[action]
    updated = time_repo.set_status(conn, timesheet_id, new_status)
    review = approvals_repo.insert_review(conn, timesheet_id, user["id"], new_status, comment)

    notifications_repo.create(
        conn,
        user_id=owner["id"],
        type="timesheet_approved" if action == "approve" else "timesheet_changes_requested",
        title="Timesheet approved" if action == "approve" else "Changes requested on your timesheet",
        body=f"Week of {ts['week_start_date'].strftime('%b %d')}" + (f" — {comment}" if comment else ""),
        link="/engagement/time/timesheets",
    )
    return {
        "id": updated["id"],
        "status": updated["status"],
        "review": review,
    }


_OVERVIEW_BY_GRANULARITY = {
    "day": time_service.auditing_overview_days,
    "week": time_service.auditing_overview,
    "month": time_service.auditing_overview_months,
}


def team_auditing(conn, user: dict, granularity: str = "week", count: int = 8) -> list[dict]:
    reports = approvals_repo.direct_reports(conn, user["id"])
    overview = _OVERVIEW_BY_GRANULARITY[granularity]
    return [
        {
            "user": {
                "id": r["id"],
                "name": f"{r['first_name']} {r['last_name']}",
                "employee_code": r["employee_code"],
                "job_title": r["job_title"],
            },
            "periods": overview(conn, r, count),
        }
        for r in reports
    ]
