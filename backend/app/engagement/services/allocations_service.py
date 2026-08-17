from datetime import date, timedelta

from app.engagement.exceptions import ForbiddenError, NotFoundError, ValidationFailedError
from app.engagement.repositories import allocations_repo, approvals_repo, portfolio_repo
from app.engagement.services.portfolio_service import authorize_project_editor
from app.engagement.services.time_service import week_bounds

MAX_WEEK_MINUTES = 10080  # 7 * 24h — a sanity ceiling, not a business rule


def _future_week_starts(weeks: int) -> list[date]:
    current_start, _ = week_bounds(date.today())
    return [current_start + timedelta(weeks=i) for i in range(weeks)]


def _past_week_starts(weeks: int) -> list[date]:
    current_start, _ = week_bounds(date.today())
    return [current_start - timedelta(weeks=i) for i in range(weeks)]


def _authorized_target(conn, user: dict, target_user_id: str) -> dict:
    """Everyone can see themselves; admins can see anyone; managers only their direct reports."""
    if str(target_user_id) == str(user["id"]):
        return user
    target = approvals_repo.user_brief(conn, target_user_id)
    if target is None:
        raise NotFoundError("Person not found")
    if user["role"] != "admin" and str(target["manager_id"]) != str(user["id"]):
        raise ForbiddenError("You can only view your direct reports' utilization")
    return target


def save_cell(
    conn, *, user: dict, project_id: str, user_id: str, week_start_date: date, minutes: int, note: str | None
) -> dict:
    project = portfolio_repo.get_project(conn, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    authorize_project_editor(user, project)
    if project["status"] in ("archived", "cancelled", "completed"):
        raise ValidationFailedError("This project can no longer take allocations")
    if not portfolio_repo.is_member(conn, project_id, user_id):
        raise ForbiddenError("This person is not a member of this project")

    monday, _ = week_bounds(week_start_date)
    if monday != week_start_date:
        raise ValidationFailedError("week_start_date must be a Monday")
    if minutes < 0 or minutes > MAX_WEEK_MINUTES:
        raise ValidationFailedError("Allocated hours must be between 0:00 and 168:00")

    if minutes == 0:
        allocations_repo.delete(conn, project_id, user_id, week_start_date)
        return {"deleted": True}

    saved = allocations_repo.upsert(
        conn,
        project_id=project_id,
        user_id=user_id,
        week_start_date=week_start_date,
        allocated_minutes=minutes,
        note=note,
    )
    return {"deleted": False, "allocation": saved}


def matrix(conn, user: dict, project_id: str, weeks: int) -> dict:
    project = portfolio_repo.get_project(conn, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    authorize_project_editor(user, project)

    people = portfolio_repo.project_members(conn, project_id)
    starts = _future_week_starts(weeks)
    rows = allocations_repo.project_rows_in_range(conn, project_id, starts[0], starts[-1] + timedelta(days=6))
    by_key = {(str(r["user_id"]), r["week_start_date"]): r for r in rows}

    return {
        "project": {"id": project["id"], "name": project["name"], "client_name": project["client_name"]},
        "weeks": [w.isoformat() for w in starts],
        "people": [
            {
                "user_id": p["id"],
                "name": f"{p['first_name']} {p['last_name']}",
                "job_title": p["job_title"],
                "capacity_minutes": int(float(p["weekly_capacity_hours"]) * 60),
                "cells": {
                    w.isoformat(): {
                        "minutes": by_key.get((str(p["id"]), w), {}).get("allocated_minutes", 0),
                        "note": by_key.get((str(p["id"]), w), {}).get("note"),
                    }
                    for w in starts
                },
            }
            for p in people
        ],
    }


def my_allocations(conn, user: dict, weeks: int) -> list[dict]:
    starts = _future_week_starts(weeks)
    rows = allocations_repo.my_rows_in_range(conn, user["id"], starts[0], starts[-1] + timedelta(days=6))
    for r in rows:
        r["week_start_date"] = r["week_start_date"].isoformat()
    return rows


def utilization(conn, user: dict, target_user_id: str | None, weeks: int) -> dict:
    person = _authorized_target(conn, user, target_user_id or user["id"])
    starts = _past_week_starts(weeks)
    range_start, range_end = starts[-1], starts[0] + timedelta(days=6)
    allocated = allocations_repo.allocated_by_week(conn, person["id"], range_start, range_end)
    logged = allocations_repo.logged_by_week(conn, person["id"], range_start, range_end)
    capacity_minutes = int(float(person["weekly_capacity_hours"]) * 60)

    weeks_out = [
        {
            "week_start_date": ws.isoformat(),
            "week_end_date": (ws + timedelta(days=6)).isoformat(),
            "allocated_minutes": allocated.get(ws, 0),
            "logged_minutes": logged.get(ws, 0),
            "capacity_minutes": capacity_minutes,
            "is_current": ws == starts[0],
        }
        for ws in starts
    ]
    return {
        "user": {"id": person["id"], "name": f"{person['first_name']} {person['last_name']}"},
        "weeks": weeks_out,
    }
