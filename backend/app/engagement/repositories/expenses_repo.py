from datetime import date
from decimal import Decimal

from app.engagement.db import dict_cursor

EXPENSE_COLUMNS = """
    e.id, e.user_id, e.project_id, e.category_id, e.expense_date, e.amount, e.currency,
    e.description, e.billable, e.receipt_note, e.other_category_note, e.status, e.submitted_at,
    e.reviewer_id, e.reviewed_at, e.review_comment, e.created_at, e.updated_at,
    p.name AS project_name, c.name AS client_name, ec.name AS category_name,
    u.first_name || ' ' || u.last_name AS user_name, u.employee_id AS employee_code,
    rv.first_name || ' ' || rv.last_name AS reviewer_name
"""
EXPENSE_JOINS = """
    FROM expenses e
    JOIN projects p ON p.id = e.project_id
    JOIN clients c ON c.id = p.client_id
    JOIN expense_categories ec ON ec.id = e.category_id
    JOIN employees u ON u.id = e.user_id
    LEFT JOIN employees rv ON rv.id = e.reviewer_id
"""


def list_categories(conn) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute("SELECT id, name, description FROM expense_categories WHERE active ORDER BY name")
        return [dict(r) for r in cur.fetchall()]


def get_category(conn, category_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute("SELECT id, name, active FROM expense_categories WHERE id=%s", (category_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get(conn, expense_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(f"SELECT {EXPENSE_COLUMNS} {EXPENSE_JOINS} WHERE e.id = %s", (expense_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def create(
    conn,
    *,
    user_id: str,
    project_id: str,
    category_id: str,
    expense_date: date,
    amount: Decimal,
    currency: str,
    description: str | None,
    billable: bool,
    receipt_note: str | None,
    other_category_note: str | None,
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO expenses
                (user_id, project_id, category_id, expense_date, amount, currency, description, billable,
                 receipt_note, other_category_note)
            VALUES (%(u)s, %(p)s, %(cat)s, %(d)s, %(amt)s, %(cur)s, %(desc)s, %(b)s, %(rn)s, %(ocn)s)
            RETURNING id, status
            """,
            {
                "u": user_id, "p": project_id, "cat": category_id, "d": expense_date, "amt": amount,
                "cur": currency, "desc": description, "b": billable, "rn": receipt_note, "ocn": other_category_note,
            },
        )
        return dict(cur.fetchone())


def update_draft(
    conn,
    expense_id: str,
    *,
    project_id: str,
    category_id: str,
    expense_date: date,
    amount: Decimal,
    currency: str,
    description: str | None,
    billable: bool,
    receipt_note: str | None,
    other_category_note: str | None,
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE expenses SET
                project_id=%(p)s, category_id=%(cat)s, expense_date=%(d)s, amount=%(amt)s,
                currency=%(cur)s, description=%(desc)s, billable=%(b)s, receipt_note=%(rn)s,
                other_category_note=%(ocn)s, updated_at=now()
            WHERE id=%(id)s
            RETURNING id, status
            """,
            {
                "id": expense_id, "p": project_id, "cat": category_id, "d": expense_date, "amt": amount,
                "cur": currency, "desc": description, "b": billable, "rn": receipt_note, "ocn": other_category_note,
            },
        )
        return dict(cur.fetchone())


def delete(conn, expense_id: str) -> int:
    with dict_cursor(conn) as cur:
        cur.execute("DELETE FROM expenses WHERE id=%s", (expense_id,))
        return cur.rowcount


def submit(conn, expense_id: str) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE expenses SET status='submitted', submitted_at=now(), updated_at=now()
            WHERE id=%s RETURNING id, status, submitted_at
            """,
            (expense_id,),
        )
        return dict(cur.fetchone())


def set_decision(conn, expense_id: str, status: str, reviewer_id: str, comment: str | None) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE expenses SET status=%s, reviewer_id=%s, reviewed_at=now(), review_comment=%s, updated_at=now()
            WHERE id=%s
            RETURNING id, status, reviewed_at
            """,
            (status, reviewer_id, comment, expense_id),
        )
        return dict(cur.fetchone())


def my_expenses(conn, user_id: str, limit: int = 100) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            f"SELECT {EXPENSE_COLUMNS} {EXPENSE_JOINS} WHERE e.user_id = %s ORDER BY e.expense_date DESC LIMIT %s",
            (user_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def inbox(conn, manager_id: str) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT {EXPENSE_COLUMNS} {EXPENSE_JOINS}
            WHERE u.manager_id = %s AND e.status = 'submitted'
            ORDER BY e.submitted_at ASC
            """,
            (manager_id,),
        )
        return [dict(r) for r in cur.fetchall()]
