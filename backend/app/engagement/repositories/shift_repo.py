from datetime import date

from app.engagement.db import dict_cursor


def active_shift_mapping(conn, user_id: str, on_date: date) -> dict | None:
    """This employee's active EmployeeShiftMapping covering on_date, joined to
    its Shift's weekend config. None if no mapping covers this date — the
    common case today (see time_service.weekend_indices_for's Sat/Sun fallback).
    Cross-table query into dev-hr's own shift schema, same pattern as deps.py's
    USER_FROM joining employees/departments/user_roles — same DB, same pool."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT s.weekend_basis, s.weekend_days
            FROM employee_shift_mappings m
            JOIN shifts s ON s.id = m.shift_id
            WHERE m.employee_id = %s AND m.is_active = true AND s.is_active = true
              AND m.effective_from <= %s
              AND (m.effective_to IS NULL OR m.effective_to >= %s)
            ORDER BY m.effective_from DESC
            LIMIT 1
            """,
            (user_id, on_date, on_date),
        )
        row = cur.fetchone()
        return dict(row) if row else None
