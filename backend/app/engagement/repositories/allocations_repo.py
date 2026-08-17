from datetime import date

from app.engagement.db import dict_cursor


def upsert(
    conn, *, project_id: str, user_id: str, week_start_date: date, allocated_minutes: int, note: str | None
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO allocations (project_id, user_id, week_start_date, allocated_minutes, note)
            VALUES (%(p)s, %(u)s, %(w)s, %(m)s, %(n)s)
            ON CONFLICT (project_id, user_id, week_start_date)
            DO UPDATE SET allocated_minutes = EXCLUDED.allocated_minutes,
                          note              = EXCLUDED.note,
                          updated_at        = now()
            RETURNING id, project_id, user_id, week_start_date, allocated_minutes, note
            """,
            {"p": project_id, "u": user_id, "w": week_start_date, "m": allocated_minutes, "n": note},
        )
        return dict(cur.fetchone())


def delete(conn, project_id: str, user_id: str, week_start_date: date) -> int:
    with dict_cursor(conn) as cur:
        cur.execute(
            "DELETE FROM allocations WHERE project_id=%s AND user_id=%s AND week_start_date=%s",
            (project_id, user_id, week_start_date),
        )
        return cur.rowcount


def project_rows_in_range(conn, project_id: str, start: date, end: date) -> list[dict]:
    """Every allocation row for a project across a week range — feeds the matrix."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT user_id, week_start_date, allocated_minutes, note
            FROM allocations
            WHERE project_id = %s AND week_start_date BETWEEN %s AND %s
            """,
            (project_id, start, end),
        )
        return [dict(r) for r in cur.fetchall()]


def my_rows_in_range(conn, user_id: str, start: date, end: date) -> list[dict]:
    """A person's own allocation rows across all projects, for the given week range."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT a.project_id, p.name AS project_name, c.name AS client_name,
                   a.week_start_date, a.allocated_minutes, a.note
            FROM allocations a
            JOIN projects p ON p.id = a.project_id
            JOIN clients c ON c.id = p.client_id
            WHERE a.user_id = %s AND a.week_start_date BETWEEN %s AND %s
            ORDER BY a.week_start_date, c.name, p.name
            """,
            (user_id, start, end),
        )
        return [dict(r) for r in cur.fetchall()]


def allocated_by_week(conn, user_id: str, start: date, end: date) -> dict[date, int]:
    """Total allocated minutes per week (summed across projects) for one person."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT week_start_date, sum(allocated_minutes) AS allocated_minutes
            FROM allocations
            WHERE user_id = %s AND week_start_date BETWEEN %s AND %s
            GROUP BY week_start_date
            """,
            (user_id, start, end),
        )
        return {r["week_start_date"]: int(r["allocated_minutes"]) for r in cur.fetchall()}


def logged_by_week(conn, user_id: str, start: date, end: date) -> dict[date, int]:
    """Total logged minutes per week for one person, bucketed to the same Monday-start weeks."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT date_trunc('week', work_date)::date AS week_start_date, sum(duration_minutes) AS logged_minutes
            FROM time_entries
            WHERE user_id = %s AND work_date BETWEEN %s AND %s
            GROUP BY date_trunc('week', work_date)
            """,
            (user_id, start, end),
        )
        return {r["week_start_date"]: int(r["logged_minutes"]) for r in cur.fetchall()}
