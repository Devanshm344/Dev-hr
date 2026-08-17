import json
from datetime import date, datetime, time, timedelta, timezone

from app.engagement.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationFailedError
from app.engagement.repositories import (
    approvals_repo, notifications_repo, portfolio_repo, shift_repo, time_repo, weekend_entries_repo,
)

EDITABLE_STATUSES = {"draft", "changes_requested"}
MAX_DAY_MINUTES = 1440

WEEKDAY_INDEX = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DEFAULT_WEEKEND_IDX = {5, 6}  # Sat, Sun — org-wide fallback when no shift override resolves

# Reminder escalation, timed from the moment the person's final shift day ends:
#   0h    -> "grace"     a soft "please submit" reminder, not yet Overdue
#   +12h  -> "overdue"   status flips to Overdue, first hard reminder
#   +7d   -> "escalated" still unsubmitted a week later, manager is looped in
REMINDER_GRACE = timedelta(hours=12)
ESCALATION_AFTER = timedelta(days=7)
DONE_STATUSES = {"submitted", "approved"}


def week_bounds(any_date: date) -> tuple[date, date]:
    """Snap any date to its Monday-start week (org setting: monday)."""
    start = any_date - timedelta(days=any_date.weekday())
    return start, start + timedelta(days=6)


def shift_due_date(week_start_date: date, shift_start_day: str) -> date:
    """The 5th working day of this person's shift (e.g. Mon-Fri -> Friday),
    within the Monday-start week that timesheet already belongs to."""
    start_idx = WEEKDAY_INDEX.get(shift_start_day, 0)
    return week_start_date + timedelta(days=(start_idx + 4) % 7)


def working_days(week_start_date: date, shift_start_day: str) -> list[date]:
    """This person's 5 working days as actual dates within this Monday-start week."""
    start_idx = WEEKDAY_INDEX.get(shift_start_day, 0)
    return [week_start_date + timedelta(days=(start_idx + i) % 7) for i in range(5)]


def missing_working_days(entries: list[dict], ts: dict, user: dict) -> list[date]:
    """Working days (per the person's shift) with no logged hours on this timesheet."""
    logged_days = {e["work_date"] for e in entries if e["duration_minutes"] > 0}
    days = working_days(ts["week_start_date"], user.get("shift_start_day", "monday"))
    return [d for d in days if d not in logged_days]


def is_working_day(d: date, shift_start_day: str) -> bool:
    """Whether `d` falls on one of this person's 5 shift working weekdays."""
    start_idx = WEEKDAY_INDEX.get(shift_start_day, 0)
    working_idx = {(start_idx + i) % 7 for i in range(5)}
    return d.weekday() in working_idx


def _weekend_weekday_indices(weekend_days_json) -> set | None:
    """Parse Shift.weekend_days (a JSON dict, e.g. {"saturday": {"all": true, ...}}
    — same shape backend/app/api/routes/shift.py reads/writes) into weekday()
    indices (Mon=0..Sun=6). Only the "all" flag is honored for v1 — the numeric
    sub-keys encode an alternating/statutory-weekend pattern that's out of scope
    here. Returns None (caller falls back to Sat/Sun) if unset, unparseable, or
    no day has "all": true.
    """
    if not weekend_days_json:
        return None
    try:
        parsed = weekend_days_json if isinstance(weekend_days_json, dict) else json.loads(weekend_days_json)
    except (TypeError, ValueError):
        return None
    if not isinstance(parsed, dict):
        return None
    idx = {i for i, name in enumerate(DAY_NAMES) if isinstance(parsed.get(name), dict) and parsed[name].get("all")}
    return idx or None


def weekend_indices_for(conn, user_id: str, week_start_date: date) -> set:
    """This employee's weekend weekdays for the week starting week_start_date:
    active EmployeeShiftMapping -> Shift.weekend_days if it resolves to
    something, else Sat/Sun. Resolved per-week (not "today"), so a past/future
    week in month view respects whatever mapping was active then."""
    mapping = shift_repo.active_shift_mapping(conn, user_id, week_start_date)
    if mapping:
        idx = _weekend_weekday_indices(mapping.get("weekend_days"))
        if idx:
            return idx
    return set(DEFAULT_WEEKEND_IDX)


def _fmt_hm(minutes: int) -> str:
    return f"{minutes // 60}:{minutes % 60:02d}"


def _add_months(d: date, delta: int) -> date:
    m = d.month - 1 + delta
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, 1)


def shift_ends_at(due_date: date) -> datetime:
    """The instant the person's final shift day is over (midnight at the end of due_date)."""
    return datetime.combine(due_date + timedelta(days=1), time.min, tzinfo=timezone.utc)


def reminder_stage(status: str, due_date: date, now: datetime | None = None) -> str | None:
    """None (on track or done) -> "grace" -> "overdue" -> "escalated"."""
    if status in DONE_STATUSES:
        return None
    now = now or datetime.now(timezone.utc)
    ends_at = shift_ends_at(due_date)
    if now < ends_at:
        return None
    if now < ends_at + REMINDER_GRACE:
        return "grace"
    if now < ends_at + ESCALATION_AFTER:
        return "overdue"
    return "escalated"


def build_grid(conn, user: dict, ts: dict) -> dict:
    """The week-grid shape shared by the owner's own view and a manager's read-only review view."""
    entries = time_repo.timesheet_entries(conn, ts["id"])

    days = [(ts["week_start_date"] + timedelta(days=i)) for i in range(7)]
    rows: dict[tuple, dict] = {}
    day_totals = {d.isoformat(): 0 for d in days}

    for e in entries:
        key = (str(e["project_id"]), str(e["task_id"]) if e["task_id"] else None)
        row = rows.setdefault(
            key,
            {
                "project_id": e["project_id"],
                "project_name": e["project_name"],
                "client_name": e["client_name"],
                "task_id": e["task_id"],
                "task_name": e["task_name"],
                "billable": e["billable"],
                "entries": {},
                "total_minutes": 0,
            },
        )
        iso = e["work_date"].isoformat()
        row["entries"][iso] = {
            "id": e["id"],
            "minutes": e["duration_minutes"],
            "note": e["description"],
        }
        row["total_minutes"] += e["duration_minutes"]
        day_totals[iso] = day_totals.get(iso, 0) + e["duration_minutes"]

    capacity_minutes = int(float(user["weekly_capacity_hours"]) * 60)
    due_date = shift_due_date(ts["week_start_date"], user.get("shift_start_day", "monday"))
    weekend_idx = weekend_indices_for(conn, user["id"], ts["week_start_date"])
    weekend_dates = [d for d in days if d.weekday() in weekend_idx]
    logged_weekend_dates = weekend_entries_repo.get_for_week(conn, user["id"], ts["week_start_date"], ts["week_end_date"])
    return {
        "timesheet": {
            "id": ts["id"],
            "week_start_date": ts["week_start_date"].isoformat(),
            "week_end_date": ts["week_end_date"].isoformat(),
            "status": ts["status"],
            "submitted_at": ts["submitted_at"].isoformat() if ts["submitted_at"] else None,
            "due_date": due_date.isoformat(),
            "reminder_stage": reminder_stage(ts["status"], due_date),
        },
        "days": [d.isoformat() for d in days],
        "capacity_minutes": capacity_minutes,
        "rows": sorted(
            rows.values(), key=lambda r: (r["client_name"], r["project_name"], r["task_name"] or "")
        ),
        "day_totals": day_totals,
        "total_minutes": sum(day_totals.values()),
        "billable_minutes": sum(
            r["total_minutes"] for r in rows.values() if r["billable"]
        ),
        "missing_working_days": [d.isoformat() for d in missing_working_days(entries, ts, user)],
        "weekend_days": [d.isoformat() for d in weekend_dates],
        "weekend_unlocked_days": [d.isoformat() for d in weekend_dates if d in logged_weekend_dates],
    }


def _empty_grid(conn, user: dict, week_start: date, week_end: date) -> dict:
    """Shape-compatible stand-in for a week nothing has ever been logged to —
    used by the read-only path so peeking at a past week (e.g. to copy its
    rows) never creates a draft timesheet for it."""
    days = [(week_start + timedelta(days=i)) for i in range(7)]
    due_date = shift_due_date(week_start, user.get("shift_start_day", "monday"))
    weekend_idx = weekend_indices_for(conn, user["id"], week_start)
    weekend_dates = [d for d in days if d.weekday() in weekend_idx]
    logged_weekend_dates = weekend_entries_repo.get_for_week(conn, user["id"], week_start, week_end)
    return {
        "timesheet": {
            "id": None,
            "week_start_date": week_start.isoformat(),
            "week_end_date": week_end.isoformat(),
            "status": "not_started",
            "submitted_at": None,
            "due_date": due_date.isoformat(),
            "reminder_stage": None,
            "latest_review": None,
        },
        "days": [d.isoformat() for d in days],
        "capacity_minutes": int(float(user["weekly_capacity_hours"]) * 60),
        "rows": [],
        "day_totals": {d.isoformat(): 0 for d in days},
        "total_minutes": 0,
        "billable_minutes": 0,
        "missing_working_days": [d.isoformat() for d in working_days(week_start, user.get("shift_start_day", "monday"))],
        "weekend_days": [d.isoformat() for d in weekend_dates],
        "weekend_unlocked_days": [d.isoformat() for d in weekend_dates if d in logged_weekend_dates],
    }


def get_week_grid(conn, user: dict, for_date: date, create: bool = True) -> dict:
    week_start, week_end = week_bounds(for_date)
    if create:
        ts = time_repo.get_or_create_timesheet(conn, user["id"], week_start, week_end)
    else:
        ts = time_repo.get_timesheet_for_week(conn, user["id"], week_start)
        if ts is None:
            return _empty_grid(conn, user, week_start, week_end)
    grid = build_grid(conn, user, ts)
    grid["timesheet"]["latest_review"] = approvals_repo.latest_review(conn, ts["id"])
    return grid


def _editable_timesheet_for(conn, user: dict, timesheet_id: str) -> dict:
    ts = time_repo.get_timesheet(conn, timesheet_id)
    if ts is None:
        raise NotFoundError("Timesheet not found")
    if str(ts["user_id"]) != str(user["id"]):
        raise ForbiddenError("This timesheet belongs to another person")
    if ts["status"] not in EDITABLE_STATUSES:
        raise ConflictError(f"A {ts['status']} timesheet can no longer be edited")
    return ts


def log_weekend_entry(conn, user: dict, *, timesheet_id: str, work_date: date, reason: str) -> dict:
    """Employee's "reason for working" on a locked weekend day. No approval
    gate — recording it unlocks the cell for them immediately; the manager
    just gets an FYI notification, same shape as submit()'s below."""
    ts = _editable_timesheet_for(conn, user, timesheet_id)

    if not (ts["week_start_date"] <= work_date <= ts["week_end_date"]):
        raise ValidationFailedError("The date is outside this timesheet's week")

    weekend_idx = weekend_indices_for(conn, user["id"], ts["week_start_date"])
    if work_date.weekday() not in weekend_idx:
        raise ValidationFailedError("This day isn't a weekend day for you")

    record, created = weekend_entries_repo.create(conn, user_id=user["id"], work_date=work_date, reason=reason.strip())

    if created and user.get("manager_id"):
        notifications_repo.create(
            conn,
            user_id=user["manager_id"],
            type="weekend_entry_logged",
            title=f"{user['first_name']} {user['last_name']} worked over the weekend",
            body=f"{work_date.strftime('%A, %b %d')}: {record['reason']}",
            link=None,
        )
    return record


def save_cell(
    conn,
    user: dict,
    *,
    timesheet_id: str,
    project_id: str,
    task_id: str | None,
    work_date: date,
    minutes: int,
    note: str | None,
) -> dict:
    ts = _editable_timesheet_for(conn, user, timesheet_id)

    if not (ts["week_start_date"] <= work_date <= ts["week_end_date"]):
        raise ValidationFailedError("The date is outside this timesheet's week")

    if minutes < 0 or minutes > MAX_DAY_MINUTES:
        raise ValidationFailedError("Hours must be between 0:00 and 24:00")

    project = time_repo.project_ok_for_time(conn, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    if project["status"] in ("archived", "cancelled", "completed"):
        raise ValidationFailedError("Time cannot be logged to this project anymore")
    if not portfolio_repo.is_member(conn, project_id, user["id"]):
        raise ForbiddenError("You are not a member of this project")

    billable = project["billing_model"] != "non_billable"
    if task_id:
        task = time_repo.task_ok_for_time(conn, task_id)
        if task is None or str(task["project_id"]) != str(project_id):
            raise ValidationFailedError("This task does not belong to the selected project")
        if task["status"] == "cancelled":
            raise ValidationFailedError("Time cannot be logged to a cancelled task")
        billable = billable and task["billable"]

    if minutes == 0:
        time_repo.delete_cell(conn, timesheet_id, project_id, task_id, work_date)
        time_repo.refresh_timesheet_totals(conn, timesheet_id)
        return {"deleted": True}

    capacity_minutes = int(float(user["weekly_capacity_hours"]) * 60)
    daily_capacity_minutes = capacity_minutes // 5

    others = time_repo.day_total_other_rows(conn, user["id"], work_date, project_id, task_id)
    if others + minutes > daily_capacity_minutes:
        raise ValidationFailedError(
            f"This would put {work_date.strftime('%a %d %b')} over its {_fmt_hm(daily_capacity_minutes)} daily capacity"
        )

    week_others = time_repo.week_total_other_cells(conn, timesheet_id, project_id, task_id, work_date)
    if week_others + minutes > capacity_minutes:
        raise ValidationFailedError(
            f"This would put the week over its {_fmt_hm(capacity_minutes)} capacity"
        )

    saved = time_repo.upsert_entry(
        conn,
        timesheet_id=timesheet_id,
        user_id=user["id"],
        work_date=work_date,
        project_id=project_id,
        task_id=task_id,
        minutes=minutes,
        description=note,
        billable=billable,
    )
    time_repo.refresh_timesheet_totals(conn, timesheet_id)
    return {"deleted": False, "entry": saved}


def remove_row(conn, user: dict, *, timesheet_id: str, project_id: str, task_id: str | None) -> int:
    _editable_timesheet_for(conn, user, timesheet_id)
    removed = time_repo.delete_row(conn, timesheet_id, project_id, task_id)
    time_repo.refresh_timesheet_totals(conn, timesheet_id)
    return removed


def submit(conn, user: dict, timesheet_id: str) -> dict:
    ts = time_repo.get_timesheet(conn, timesheet_id)
    if ts is None:
        raise NotFoundError("Timesheet not found")
    if str(ts["user_id"]) != str(user["id"]):
        raise ForbiddenError("This timesheet belongs to another person")
    if ts["status"] == "submitted":
        raise ConflictError("This week has already been submitted")
    if ts["status"] == "approved":
        raise ConflictError("This week has already been approved")

    entries = time_repo.timesheet_entries(conn, timesheet_id)
    if not entries:
        raise ValidationFailedError("Add at least one time entry before submitting")

    missing = missing_working_days(entries, ts, user)
    if missing:
        raise ValidationFailedError(
            "Add hours to all 5 working days before submitting — missing "
            + ", ".join(d.strftime("%A") for d in missing)
        )

    capacity_minutes = int(float(user["weekly_capacity_hours"]) * 60)
    total_minutes = sum(e["duration_minutes"] for e in entries)
    if total_minutes > capacity_minutes:
        raise ValidationFailedError(
            f"Logged hours ({_fmt_hm(total_minutes)}) exceed your {_fmt_hm(capacity_minutes)} weekly capacity — "
            "reduce hours before submitting"
        )

    time_repo.refresh_timesheet_totals(conn, timesheet_id)
    submitted = time_repo.submit_timesheet(conn, timesheet_id)

    if user.get("manager_id"):
        notifications_repo.create(
            conn,
            user_id=user["manager_id"],
            type="timesheet_submitted",
            title=f"{user['first_name']} {user['last_name']} submitted a timesheet",
            body=f"Week of {ts['week_start_date'].strftime('%b %d')} is awaiting your review",
            link=f"/engagement/approvals/{timesheet_id}",
        )
    return submitted


def auditing_overview(conn, user: dict, weeks: int = 8) -> list[dict]:
    """Per-week compliance for the signed-in person: logged vs required, status."""
    today = date.today()
    current_start, _ = week_bounds(today)
    sheets = {s["week_start_date"]: s for s in time_repo.my_timesheets(conn, user["id"], limit=52)}
    capacity_minutes = int(float(user["weekly_capacity_hours"]) * 60)

    shift_start_day = user.get("shift_start_day", "monday")
    out = []
    for i in range(weeks):
        ws = current_start - timedelta(weeks=i)
        we = ws + timedelta(days=6)
        s = sheets.get(ws)
        logged = s["total_minutes"] if s else 0
        status = s["status"] if s else "not_started"
        due_date = shift_due_date(ws, shift_start_day)
        out.append(
            {
                "week_start_date": ws.isoformat(),
                "week_end_date": we.isoformat(),
                "logged_minutes": logged,
                "capacity_minutes": capacity_minutes,
                "missing_minutes": max(capacity_minutes - logged, 0),
                "status": status,
                "is_current": ws == current_start,
                "due_date": due_date.isoformat(),
                "reminder_stage": reminder_stage(status, due_date),
            }
        )
    return out


def my_timesheets_days(conn, user: dict, days: int = 14) -> list[dict]:
    """Per-day totals for the signed-in person's own submissions, tied to the parent week's status."""
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    totals = time_repo.daily_totals_split(conn, user["id"], start_date, today)

    first_week_start, _ = week_bounds(start_date)
    weeks_span = (today - first_week_start).days // 7 + 2
    sheets = {s["week_start_date"]: s for s in time_repo.my_timesheets(conn, user["id"], limit=weeks_span)}

    out = []
    for i in range(days):
        d = today - timedelta(days=i)
        ws, _ = week_bounds(d)
        s = sheets.get(ws)
        status = s["status"] if s else "not_started"
        submitted_at = s["submitted_at"] if s else None
        t = totals.get(d, {"total": 0, "billable": 0})
        out.append(
            {
                "date": d.isoformat(),
                "total_minutes": t["total"],
                "billable_minutes": t["billable"],
                "status": status,
                "submitted_at": submitted_at.isoformat() if submitted_at else None,
                "is_today": d == today,
            }
        )
    return out


def my_timesheets_months(conn, user: dict, months: int = 3) -> list[dict]:
    """Weekly submissions bucketed by the calendar month each week starts in."""
    today = date.today()
    current_month_start = today.replace(day=1)
    first_month_start = _add_months(current_month_start, -(months - 1))
    weeks_needed = (today - first_month_start).days // 7 + 2
    sheets = time_repo.my_timesheets(conn, user["id"], limit=max(weeks_needed, 52))

    buckets: dict[str, list[dict]] = {}
    for s in sheets:
        ws = s["week_start_date"]
        buckets.setdefault(f"{ws.year:04d}-{ws.month:02d}", []).append(s)

    out = []
    for i in range(months):
        ms = _add_months(current_month_start, -i)
        key = f"{ms.year:04d}-{ms.month:02d}"
        month_weeks = buckets.get(key, [])
        latest_submitted = max((w["submitted_at"] for w in month_weeks if w["submitted_at"]), default=None)
        out.append(
            {
                "month": key,
                "label": ms.strftime("%B %Y"),
                "total_minutes": sum(w["total_minutes"] for w in month_weeks),
                "billable_minutes": sum(w["billable_minutes"] for w in month_weeks),
                "weeks_total": len(month_weeks),
                "weeks_approved": sum(1 for w in month_weeks if w["status"] == "approved"),
                "submitted_at": latest_submitted.isoformat() if latest_submitted else None,
                "is_current": key == f"{current_month_start.year:04d}-{current_month_start.month:02d}",
            }
        )
    return out


def auditing_overview_days(conn, user: dict, days: int = 14) -> list[dict]:
    """Per-day compliance for the signed-in person, tied to the parent week's status."""
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    totals = time_repo.daily_logged_totals(conn, user["id"], start_date, today)

    shift_start_day = user.get("shift_start_day", "monday")
    daily_capacity = int(float(user["weekly_capacity_hours"]) * 60) // 5

    first_week_start, _ = week_bounds(start_date)
    weeks_span = (today - first_week_start).days // 7 + 2
    sheets = {s["week_start_date"]: s for s in time_repo.my_timesheets(conn, user["id"], limit=weeks_span)}

    out = []
    for i in range(days):
        d = today - timedelta(days=i)
        ws, _ = week_bounds(d)
        s = sheets.get(ws)
        status = s["status"] if s else "not_started"
        working = is_working_day(d, shift_start_day)
        logged = totals.get(d, 0)
        capacity = daily_capacity if working else 0
        out.append(
            {
                "date": d.isoformat(),
                "is_working_day": working,
                "logged_minutes": logged,
                "capacity_minutes": capacity,
                "missing_minutes": max(capacity - logged, 0),
                "status": status,
                "is_today": d == today,
            }
        )
    return out


def auditing_overview_months(conn, user: dict, months: int = 3) -> list[dict]:
    """Per-month compliance for the signed-in person: weekly rows bucketed by the
    calendar month each week starts in."""
    today = date.today()
    current_month_start = today.replace(day=1)
    first_month_start = _add_months(current_month_start, -(months - 1))
    weeks_needed = (today - first_month_start).days // 7 + 2
    weeks = auditing_overview(conn, user, weeks_needed)

    buckets: dict[str, list[dict]] = {}
    for w in weeks:
        ws = date.fromisoformat(w["week_start_date"])
        buckets.setdefault(f"{ws.year:04d}-{ws.month:02d}", []).append(w)

    stage_rank = {None: 0, "grace": 1, "overdue": 2, "escalated": 3}
    out = []
    for i in range(months):
        ms = _add_months(current_month_start, -i)
        key = f"{ms.year:04d}-{ms.month:02d}"
        month_weeks = buckets.get(key, [])
        worst_stage = None
        for w in month_weeks:
            if stage_rank[w["reminder_stage"]] > stage_rank[worst_stage]:
                worst_stage = w["reminder_stage"]
        out.append(
            {
                "month": key,
                "label": ms.strftime("%B %Y"),
                "logged_minutes": sum(w["logged_minutes"] for w in month_weeks),
                "capacity_minutes": sum(w["capacity_minutes"] for w in month_weeks),
                "missing_minutes": sum(w["missing_minutes"] for w in month_weeks),
                "weeks_total": len(month_weeks),
                "weeks_approved": sum(1 for w in month_weeks if w["status"] == "approved"),
                "reminder_stage": worst_stage,
                "is_current": key == f"{current_month_start.year:04d}-{current_month_start.month:02d}",
            }
        )
    return out
