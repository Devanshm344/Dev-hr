from fastapi import Depends, Header

# Auth is dev-hr's, not this module's: the merged app has exactly one login
# (dev-hr's /api/auth/login) and one JWT decoder — this just reuses it, so a
# dev-hr session is automatically valid here with no second sign-in.
from app.core.security import decode_token
from app.engagement.db import dict_cursor, get_db
from app.engagement.exceptions import UnauthorizedError, ForbiddenError

# Identity is owned by dev-hr, not this app: `employees` is the person table
# (INTEGER PK), `departments` gives the department name, and `user_roles` +
# manager hierarchy (does this employee have direct reports?) gives the
# system role. dev-hr has no per-employee weekly-hours or shift-start-day
# concept (employee_shift_mappings only carries a shift's clock times, and
# every shift's weekend_days is unset), so both are fixed org-wide defaults
# matching organization_settings (40h/week, Monday-start week).
USER_COLUMNS = """
    u.id, u.employee_id AS employee_code, u.first_name, u.last_name, u.email,
    u.title AS job_title, d.name AS department, u.manager_id, u.timezone,
    40 AS weekly_capacity_hours, 'monday' AS shift_start_day, u.status::text AS status,
    CASE
        WHEN ur.system_role IN ('Admin', 'Super Admin') THEN 'admin'
        WHEN EXISTS (SELECT 1 FROM employees mgr WHERE mgr.manager_id = u.id) THEN 'manager'
        ELSE 'employee'
    END AS role
"""
USER_FROM = """
    employees u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN user_roles ur ON ur.employee_id = u.employee_id
"""
ACTIVE_STATUSES = ("active", "on_leave")


def get_current_user(
    authorization: str | None = Header(default=None),
    conn=Depends(get_db),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError("Authentication required")
    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if payload is None:
        raise UnauthorizedError("Invalid or expired session, please sign in again")

    with dict_cursor(conn) as cur:
        cur.execute(
            f"SELECT {USER_COLUMNS} FROM {USER_FROM} WHERE u.id = %s",
            (int(payload["sub"]),),
        )
        user = cur.fetchone()
    if user is None:
        raise UnauthorizedError("Account not found")
    if user["status"] not in ACTIVE_STATUSES:
        raise UnauthorizedError("This account is not active")
    return dict(user)


def require_roles(*roles: str):
    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise ForbiddenError("You do not have permission to do this")
        return user

    return checker
