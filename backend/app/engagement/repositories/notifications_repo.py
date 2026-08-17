from app.engagement.db import dict_cursor


def create(conn, *, user_id: str, type: str, title: str, body: str | None, link: str | None) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO notifications (user_id, type, title, body, link)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, type, title, body, link, read_at, created_at
            """,
            (user_id, type, title, body, link),
        )
        return dict(cur.fetchone())


def list_for_user(conn, user_id: str, limit: int = 30) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT id, type, title, body, link, read_at, created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def unread_count(conn, user_id: str) -> int:
    with dict_cursor(conn) as cur:
        cur.execute(
            "SELECT count(*) AS n FROM notifications WHERE user_id = %s AND read_at IS NULL",
            (user_id,),
        )
        return cur.fetchone()["n"]


def mark_read(conn, user_id: str, notification_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE notifications SET read_at = COALESCE(read_at, now())
            WHERE id = %s AND user_id = %s
            RETURNING id, type, title, body, link, read_at, created_at
            """,
            (notification_id, user_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def mark_all_read(conn, user_id: str) -> int:
    with dict_cursor(conn) as cur:
        cur.execute(
            "UPDATE notifications SET read_at = now() WHERE user_id = %s AND read_at IS NULL",
            (user_id,),
        )
        return cur.rowcount
