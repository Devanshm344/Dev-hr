import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.engagement.db import dict_cursor, get_db
from app.engagement.deps import get_current_user
from app.engagement.exceptions import ValidationFailedError

router = APIRouter(prefix="/reports", tags=["reports"])

GROUPINGS = {
    "project": ("p.name", "c.name || ' / ' || p.name"),
    "task": ("p.name, t.name", "p.name || ' / ' || coalesce(t.name,'(no task)')"),
    "person": ("u.first_name, u.last_name", "u.first_name || ' ' || u.last_name"),
    "day": ("e.work_date", "to_char(e.work_date,'YYYY-MM-DD')"),
}


def _time_report_rows(conn, user: dict, start: date, end: date, group_by: str, project_id: str | None):
    if group_by not in GROUPINGS:
        raise ValidationFailedError("group_by must be one of: project, task, person, day")
    if group_by == "person" and user["role"] == "employee":
        raise ValidationFailedError("Grouping by person is available to managers and administrators")

    order_expr, label_expr = GROUPINGS[group_by]
    scope = "" if user["role"] in ("admin", "manager") else "AND e.user_id = %(uid)s"
    proj = "AND e.project_id = %(pid)s" if project_id else ""

    sql = f"""
        SELECT {label_expr} AS label,
               sum(e.duration_minutes) AS total_minutes,
               sum(e.duration_minutes) FILTER (WHERE e.billable) AS billable_minutes,
               count(*) AS entry_count
        FROM time_entries e
        JOIN projects p ON p.id = e.project_id
        JOIN clients  c ON c.id = p.client_id
        LEFT JOIN tasks t ON t.id = e.task_id
        JOIN employees u ON u.id = e.user_id
        WHERE e.work_date BETWEEN %(start)s AND %(end)s {scope} {proj}
        GROUP BY {label_expr}, {order_expr}
        ORDER BY {order_expr}
    """
    params = {"start": start, "end": end, "uid": user["id"], "pid": project_id}
    with dict_cursor(conn) as cur:
        cur.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        r["total_minutes"] = int(r["total_minutes"] or 0)
        r["billable_minutes"] = int(r["billable_minutes"] or 0)
    return rows


def _default_range() -> tuple[date, date]:
    today = date.today()
    start = today - timedelta(days=today.weekday(), weeks=3)
    return start, today


def _empty_project_summary() -> dict:
    return {
        "week_start_date": None,
        "week_end_date": None,
        "total_projects": 0,
        "active_projects": 0,
        "client_projects": 0,
        "internal_projects": 0,
        "active_client_projects": 0,
        "active_internal_projects": 0,
        "active_client_project_names": [],
        "active_internal_project_names": [],
    }


def _project_summary(conn, user_id: str) -> dict:
    """Projects contributed to in this person's most recently APPROVED week —
    a confirmed, week-scoped snapshot (not an all-time running total), so it
    only advances once a manager has signed off on that week's timesheet.
    Stays on the last approved week until the next one is also approved."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT id, week_start_date, week_end_date
            FROM timesheets
            WHERE user_id = %(uid)s AND status = 'approved'
            ORDER BY week_start_date DESC
            LIMIT 1
            """,
            {"uid": user_id},
        )
        latest = cur.fetchone()
    if latest is None:
        return _empty_project_summary()

    sql = """
        SELECT DISTINCT p.id, p.name, p.status, p.billing_model
        FROM time_entries e
        JOIN projects p ON p.id = e.project_id
        WHERE e.timesheet_id = %(tsid)s
        ORDER BY p.name
    """
    with dict_cursor(conn) as cur:
        cur.execute(sql, {"tsid": latest["id"]})
        rows = [dict(r) for r in cur.fetchall()]

    total = len(rows)
    active_rows = [r for r in rows if r["status"] == "active"]
    internal = sum(1 for r in rows if r["billing_model"] == "non_billable")
    active_internal_rows = [r for r in active_rows if r["billing_model"] == "non_billable"]
    active_client_rows = [r for r in active_rows if r["billing_model"] != "non_billable"]
    return {
        "week_start_date": latest["week_start_date"].isoformat(),
        "week_end_date": latest["week_end_date"].isoformat(),
        "total_projects": total,
        "active_projects": len(active_rows),
        "client_projects": total - internal,
        "internal_projects": internal,
        "active_client_projects": len(active_client_rows),
        "active_internal_projects": len(active_internal_rows),
        "active_client_project_names": [r["name"] for r in active_client_rows],
        "active_internal_project_names": [r["name"] for r in active_internal_rows],
    }


@router.get("/project-summary")
def project_summary(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    return {"data": _project_summary(conn, user["id"])}


def _dashboard_data(conn, user: dict, start: date, end: date, project_id: str | None) -> dict:
    managerish = user["role"] in ("admin", "manager")
    scope = "" if managerish else "AND e.user_id = %(uid)s"
    proj = "AND e.project_id = %(pid)s" if project_id else ""
    params = {"start": start, "end": end, "uid": user["id"], "pid": project_id}

    with dict_cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT p.id AS project_id, c.name || ' / ' || p.name AS label,
                   sum(e.duration_minutes) AS total_minutes,
                   sum(e.duration_minutes) FILTER (WHERE e.billable) AS billable_minutes
            FROM time_entries e
            JOIN projects p ON p.id = e.project_id
            JOIN clients  c ON c.id = p.client_id
            WHERE e.work_date BETWEEN %(start)s AND %(end)s {scope} {proj}
            GROUP BY p.id, c.name, p.name
            ORDER BY total_minutes DESC
            """,
            params,
        )
        by_project = [dict(r) for r in cur.fetchall()]
    for r in by_project:
        r["total_minutes"] = int(r["total_minutes"] or 0)
        r["billable_minutes"] = int(r["billable_minutes"] or 0)

    by_person = None
    matrix = None
    if managerish:
        with dict_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT u.id AS user_id, u.first_name || ' ' || u.last_name AS label,
                       sum(e.duration_minutes) AS total_minutes
                FROM time_entries e
                JOIN employees u ON u.id = e.user_id
                WHERE e.work_date BETWEEN %(start)s AND %(end)s {proj}
                GROUP BY u.id, u.first_name, u.last_name
                ORDER BY total_minutes DESC
                """,
                params,
            )
            by_person = [dict(r) for r in cur.fetchall()]
        for r in by_person:
            r["total_minutes"] = int(r["total_minutes"] or 0)

        with dict_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT u.id AS user_id, u.first_name || ' ' || u.last_name AS person_label,
                       p.id AS project_id, c.name || ' / ' || p.name AS project_label,
                       sum(e.duration_minutes) AS total_minutes
                FROM time_entries e
                JOIN employees u ON u.id = e.user_id
                JOIN projects p ON p.id = e.project_id
                JOIN clients  c ON c.id = p.client_id
                WHERE e.work_date BETWEEN %(start)s AND %(end)s {proj}
                GROUP BY u.id, u.first_name, u.last_name, p.id, c.name, p.name
                ORDER BY person_label, total_minutes DESC
                """,
                params,
            )
            matrix = [dict(r) for r in cur.fetchall()]
        for r in matrix:
            r["total_minutes"] = int(r["total_minutes"] or 0)

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_minutes": sum(r["total_minutes"] for r in by_project),
        "billable_minutes": sum(r["billable_minutes"] for r in by_project),
        "project_count": len(by_project),
        "contributor_count": len(by_person) if by_person is not None else None,
        "by_project": by_project,
        "by_person": by_person,
        "matrix": matrix,
    }


@router.get("/dashboard")
def dashboard(
    start: date | None = None,
    end: date | None = None,
    project_id: str | None = None,
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    d_start, d_end = _default_range()
    start, end = start or d_start, end or d_end
    if end < start:
        raise ValidationFailedError("End date must be on or after the start date")
    return {"data": _dashboard_data(conn, user, start, end, project_id)}


@router.get("/time")
def time_report(
    start: date | None = None,
    end: date | None = None,
    group_by: str = Query(default="project"),
    project_id: str | None = None,
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    d_start, d_end = _default_range()
    start, end = start or d_start, end or d_end
    if end < start:
        raise ValidationFailedError("End date must be on or after the start date")
    rows = _time_report_rows(conn, user, start, end, group_by, project_id)
    return {
        "data": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "group_by": group_by,
            "rows": rows,
            "total_minutes": sum(r["total_minutes"] for r in rows),
            "billable_minutes": sum(r["billable_minutes"] for r in rows),
        }
    }


@router.get("/time/export")
def time_report_csv(
    start: date | None = None,
    end: date | None = None,
    group_by: str = Query(default="project"),
    project_id: str | None = None,
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    d_start, d_end = _default_range()
    start, end = start or d_start, end or d_end
    rows = _time_report_rows(conn, user, start, end, group_by, project_id)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([group_by.title(), "Hours", "Billable hours", "Entries"])
    for r in rows:
        writer.writerow(
            [r["label"], round(r["total_minutes"] / 60, 2), round(r["billable_minutes"] / 60, 2), r["entry_count"]]
        )
    buf.seek(0)
    filename = f"time-report_{start.isoformat()}_{end.isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
