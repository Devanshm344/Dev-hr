from app.engagement.db import dict_cursor
from app.engagement.deps import ACTIVE_STATUSES, USER_COLUMNS, USER_FROM


def user_brief(conn, user_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            f"SELECT {USER_COLUMNS} FROM {USER_FROM} WHERE u.id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def direct_reports(conn, manager_id: str) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT {USER_COLUMNS}
            FROM {USER_FROM}
            WHERE u.manager_id = %s AND u.status::text = ANY(%s)
            ORDER BY u.first_name, u.last_name
            """,
            (manager_id, list(ACTIVE_STATUSES)),
        )
        return [dict(r) for r in cur.fetchall()]


def inbox(conn, manager_id: str) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT t.id, t.week_start_date, t.week_end_date, t.total_minutes, t.billable_minutes,
                   t.submitted_at, 40 AS weekly_capacity_hours,
                   u.id AS user_id, u.first_name, u.last_name, u.employee_id AS employee_code, u.title AS job_title
            FROM timesheets t
            JOIN employees u ON u.id = t.user_id
            WHERE u.manager_id = %s AND t.status = 'submitted'
            ORDER BY t.submitted_at ASC
            """,
            (manager_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def insert_review(conn, timesheet_id: str, reviewer_id: str, action: str, comment: str | None) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO timesheet_reviews (timesheet_id, reviewer_id, action, comment)
            VALUES (%s, %s, %s, %s)
            RETURNING id, timesheet_id, reviewer_id, action, comment, created_at
            """,
            (timesheet_id, reviewer_id, action, comment),
        )
        return dict(cur.fetchone())


def list_reviews(conn, timesheet_id: str) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT r.id, r.action, r.comment, r.created_at,
                   r.reviewer_id, u.first_name || ' ' || u.last_name AS reviewer_name
            FROM timesheet_reviews r
            JOIN employees u ON u.id = r.reviewer_id
            WHERE r.timesheet_id = %s
            ORDER BY r.created_at DESC
            """,
            (timesheet_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def latest_review(conn, timesheet_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT r.id, r.action, r.comment, r.created_at,
                   r.reviewer_id, u.first_name || ' ' || u.last_name AS reviewer_name
            FROM timesheet_reviews r
            JOIN employees u ON u.id = r.reviewer_id
            WHERE r.timesheet_id = %s
            ORDER BY r.created_at DESC
            LIMIT 1
            """,
            (timesheet_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
