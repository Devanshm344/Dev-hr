from datetime import date

from app.engagement.db import dict_cursor


def get_for_week(conn, user_id: str, week_start: date, week_end: date) -> set:
    with dict_cursor(conn) as cur:
        cur.execute(
            "SELECT work_date FROM weekend_time_entries WHERE user_id=%s AND work_date BETWEEN %s AND %s",
            (user_id, week_start, week_end),
        )
        return {r["work_date"] for r in cur.fetchall()}


def create(conn, *, user_id: str, work_date: date, reason: str) -> tuple[dict, bool]:
    """Returns (record, created). created=False means a reason already existed
    for this (user, date) — ON CONFLICT DO NOTHING makes resubmission a no-op
    that keeps the original reason instead of erroring or duplicating."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO weekend_time_entries (user_id, work_date, reason)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, work_date) DO NOTHING
            RETURNING id, user_id, work_date, reason, created_at
            """,
            (user_id, work_date, reason),
        )
        row = cur.fetchone()
        if row:
            return dict(row), True
        cur.execute(
            "SELECT id, user_id, work_date, reason, created_at FROM weekend_time_entries WHERE user_id=%s AND work_date=%s",
            (user_id, work_date),
        )
        return dict(cur.fetchone()), False
