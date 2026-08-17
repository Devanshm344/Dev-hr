from datetime import date

from app.engagement.db import dict_cursor

NIL_UUID = "00000000-0000-0000-0000-000000000000"


def get_or_create_timesheet(conn, user_id: str, week_start: date, week_end: date) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO timesheets (user_id, week_start_date, week_end_date)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, week_start_date) DO NOTHING
            """,
            (user_id, week_start, week_end),
        )
        cur.execute(
            "SELECT * FROM timesheets WHERE user_id=%s AND week_start_date=%s",
            (user_id, week_start),
        )
        return dict(cur.fetchone())


def get_timesheet_for_week(conn, user_id: str, week_start: date) -> dict | None:
    """Read-only lookup — unlike get_or_create_timesheet, never creates a row.
    Used to peek at a past week (e.g. to copy its rows) without leaving a
    stray draft timesheet behind for a week nothing was ever logged to."""
    with dict_cursor(conn) as cur:
        cur.execute(
            "SELECT * FROM timesheets WHERE user_id=%s AND week_start_date=%s",
            (user_id, week_start),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_timesheet(conn, timesheet_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute("SELECT * FROM timesheets WHERE id=%s", (timesheet_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def timesheet_entries(conn, timesheet_id: str) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT e.id, e.work_date, e.duration_minutes, e.description, e.billable,
                   e.project_id, p.name AS project_name, c.name AS client_name,
                   e.task_id, t.name AS task_name
            FROM time_entries e
            JOIN projects p ON p.id = e.project_id
            JOIN clients c ON c.id = p.client_id
            LEFT JOIN tasks t ON t.id = e.task_id
            WHERE e.timesheet_id = %s
            ORDER BY c.name, p.name, t.name NULLS FIRST, e.work_date
            """,
            (timesheet_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def upsert_entry(
    conn,
    *,
    timesheet_id: str,
    user_id: str,
    work_date: date,
    project_id: str,
    task_id: str | None,
    minutes: int,
    description: str | None,
    billable: bool,
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO time_entries
                (timesheet_id, user_id, work_date, project_id, task_id, duration_minutes, description, billable)
            VALUES (%(ts)s, %(uid)s, %(d)s, %(p)s, %(t)s, %(m)s, %(desc)s, %(b)s)
            ON CONFLICT (timesheet_id, project_id, coalesce(task_id,%(nil)s::uuid), work_date)
            DO UPDATE SET duration_minutes = EXCLUDED.duration_minutes,
                          description      = coalesce(EXCLUDED.description, time_entries.description),
                          updated_at       = now()
            RETURNING id, work_date, duration_minutes, description, billable
            """,
            {
                "ts": timesheet_id, "uid": user_id, "d": work_date, "p": project_id,
                "t": task_id, "m": minutes, "desc": description, "b": billable, "nil": NIL_UUID,
            },
        )
        return dict(cur.fetchone())


def delete_cell(conn, timesheet_id: str, project_id: str, task_id: str | None, work_date: date) -> None:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            DELETE FROM time_entries
            WHERE timesheet_id=%s AND project_id=%s
              AND coalesce(task_id, %s::uuid) = coalesce(%s, %s)::uuid
              AND work_date=%s
            """,
            (timesheet_id, project_id, NIL_UUID, task_id, NIL_UUID, work_date),
        )


def delete_row(conn, timesheet_id: str, project_id: str, task_id: str | None) -> int:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            DELETE FROM time_entries
            WHERE timesheet_id=%s AND project_id=%s
              AND coalesce(task_id, %s::uuid) = coalesce(%s, %s)::uuid
            """,
            (timesheet_id, project_id, NIL_UUID, task_id, NIL_UUID),
        )
        return cur.rowcount


def day_total_other_rows(
    conn, user_id: str, work_date: date, exclude_project: str, exclude_task: str | None
) -> int:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT coalesce(sum(duration_minutes),0) AS total
            FROM time_entries
            WHERE user_id=%s AND work_date=%s
              AND NOT (project_id=%s AND coalesce(task_id,%s::uuid)=coalesce(%s,%s)::uuid)
            """,
            (user_id, work_date, exclude_project, NIL_UUID, exclude_task, NIL_UUID),
        )
        return int(cur.fetchone()["total"])


def week_total_other_cells(
    conn, timesheet_id: str, project_id: str, task_id: str | None, work_date: date
) -> int:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT coalesce(sum(duration_minutes),0) AS total
            FROM time_entries
            WHERE timesheet_id=%s
              AND NOT (project_id=%s AND coalesce(task_id,%s::uuid)=coalesce(%s,%s)::uuid AND work_date=%s)
            """,
            (timesheet_id, project_id, NIL_UUID, task_id, NIL_UUID, work_date),
        )
        return int(cur.fetchone()["total"])


def refresh_timesheet_totals(conn, timesheet_id: str) -> None:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE timesheets ts SET
              total_minutes    = coalesce((SELECT sum(duration_minutes) FROM time_entries WHERE timesheet_id=ts.id),0),
              billable_minutes = coalesce((SELECT sum(duration_minutes) FROM time_entries WHERE timesheet_id=ts.id AND billable),0),
              updated_at = now()
            WHERE ts.id = %s
            """,
            (timesheet_id,),
        )


def set_status(conn, timesheet_id: str, status: str) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            "UPDATE timesheets SET status=%s, updated_at=now() WHERE id=%s RETURNING *",
            (status, timesheet_id),
        )
        return dict(cur.fetchone())


def submit_timesheet(conn, timesheet_id: str) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE timesheets SET status='submitted', submitted_at=now(), updated_at=now()
            WHERE id=%s RETURNING *
            """,
            (timesheet_id,),
        )
        return dict(cur.fetchone())


def my_timesheets(conn, user_id: str, limit: int = 26) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT id, week_start_date, week_end_date, total_minutes, billable_minutes,
                   status, submitted_at
            FROM timesheets
            WHERE user_id=%s
            ORDER BY week_start_date DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def daily_logged_totals(conn, user_id: str, start_date: date, end_date: date) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT work_date, sum(duration_minutes) AS total
            FROM time_entries
            WHERE user_id=%s AND work_date BETWEEN %s AND %s
            GROUP BY work_date
            """,
            (user_id, start_date, end_date),
        )
        return {r["work_date"]: int(r["total"]) for r in cur.fetchall()}


def daily_totals_split(conn, user_id: str, start_date: date, end_date: date) -> dict:
    """Per-day total and billable minutes, for the Timesheets page's day view."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT work_date,
                   sum(duration_minutes) AS total,
                   sum(duration_minutes) FILTER (WHERE billable) AS billable
            FROM time_entries
            WHERE user_id=%s AND work_date BETWEEN %s AND %s
            GROUP BY work_date
            """,
            (user_id, start_date, end_date),
        )
        return {r["work_date"]: {"total": int(r["total"]), "billable": int(r["billable"] or 0)} for r in cur.fetchall()}


def reminder_candidates(conn) -> list[dict]:
    """Every not-yet-submitted timesheet, with enough about the employee (and
    their manager) to compute a reminder stage and address an email."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT ts.id, ts.week_start_date, ts.week_end_date, ts.status,
                   ts.due_reminder_sent_at, ts.overdue_notified_at, ts.escalated_at,
                   u.id AS user_id, u.first_name, u.last_name, u.email, 'monday' AS shift_start_day,
                   m.first_name AS manager_first_name, m.last_name AS manager_last_name, m.email AS manager_email
            FROM timesheets ts
            JOIN employees u ON u.id = ts.user_id
            LEFT JOIN employees m ON m.id = u.manager_id
            WHERE ts.status NOT IN ('submitted', 'approved') AND u.status IN ('active', 'on_leave')
            """
        )
        return [dict(r) for r in cur.fetchall()]


def mark_reminder_sent(conn, timesheet_id: str, column: str) -> None:
    assert column in ("due_reminder_sent_at", "overdue_notified_at", "escalated_at")
    with dict_cursor(conn) as cur:
        cur.execute(f"UPDATE timesheets SET {column} = now() WHERE id = %s", (timesheet_id,))


def project_ok_for_time(conn, project_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute("SELECT id, status, billing_model FROM projects WHERE id=%s", (project_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def task_ok_for_time(conn, task_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute("SELECT id, project_id, status, billable FROM tasks WHERE id=%s", (task_id,))
        row = cur.fetchone()
        return dict(row) if row else None
