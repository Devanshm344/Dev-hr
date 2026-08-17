import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import PlainTextResponse

from core.audit import log_audit
from core.auth import SESSION_COOKIE, verify_session_token
from core.db import get_pool
from core.deps import require_role
from core.notifications import create_notification
from core.sql_utils import affected_count

router = APIRouter(prefix="/api/users")

staff_only = Depends(require_role("hr", "admin"))

USER_FIELDS = """id, first_name, last_name, full_name, email, phone, linkedin_url, profile_photo_path,
    country, state, professional_status, employer, designation, industry, resume_path,
    joining_month, joining_year, exited_year, roles_held, achievements, status,
    created_at, updated_at"""

STATUS_NOTIFICATIONS = {
    "active": ("account", "Registration Approved", "Your alumni registration has been approved. You can now log in to the Alumni Portal.", "/portal/dashboard"),
    "rejected": ("account", "Registration Update", "Your registration was not approved. Please contact HR for more information.", None),
    "inactive": ("account", "Account Deactivated", "Your alumni account has been deactivated. Contact HR if you believe this is a mistake.", None),
}

FIELD_MAP = {"status": "status", "firstName": "first_name", "lastName": "last_name", "phone": "phone", "country": "country", "state": "state", "employer": "employer", "designation": "designation", "industry": "industry", "joiningYear": "joining_year", "linkedinUrl": "linkedin_url"}

LINKEDIN_URL_RE = re.compile(r"^https?://[^\s/]+\.[^\s/]+")


def csv_escape(value) -> str:
    if value is None:
        return ""
    s = str(value)
    if any(c in s for c in [",", '"', "\n"]):
        return '"' + s.replace('"', '""') + '"'
    return s


@router.get("", dependencies=[staff_only])
async def list_users(status: Optional[str] = None, search: Optional[str] = None, page: int = Query(1), pageSize: int = Query(20)):
    page = max(1, page)
    page_size = min(100, max(1, pageSize))
    conditions = ["status != 'system'"]
    params: list = []
    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        params.append(statuses)
        conditions.append(f"status = ANY(${len(params)})")
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"(full_name ILIKE ${len(params)} OR email ILIKE ${len(params)})")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    pool = get_pool()
    total = await pool.fetchval(f"SELECT count(*)::int FROM users {where}", *params)

    data_params = [*params, page_size, (page - 1) * page_size]
    rows = await pool.fetch(
        f"""SELECT {USER_FIELDS} FROM users {where}
            ORDER BY created_at DESC, id DESC LIMIT ${len(data_params) - 1} OFFSET ${len(data_params)}""",
        *data_params,
    )
    return {"users": [dict(r) for r in rows], "total": total, "page": page, "pageSize": page_size}


@router.get("/export", dependencies=[staff_only])
async def export_users(status: Optional[str] = None, search: Optional[str] = None):
    conditions = ["status != 'system'"]
    params: list = []
    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        params.append(statuses)
        conditions.append(f"status = ANY(${len(params)})")
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"(full_name ILIKE ${len(params)} OR email ILIKE ${len(params)})")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = await get_pool().fetch(
        f"""SELECT full_name, email, phone, employer, designation, industry, joining_month, joining_year, status, linkedin_url, created_at
            FROM users {where} ORDER BY full_name ASC""",
        *params,
    )

    headers = ["Full Name", "Email", "Phone", "Employer", "Designation", "Industry", "Joining Month", "Joining Year", "Status", "LinkedIn", "Registered On"]
    lines = [",".join(headers)]
    for r in rows:
        lines.append(",".join([
            csv_escape(r["full_name"]), csv_escape(r["email"]), csv_escape(r["phone"]),
            csv_escape(r["employer"]), csv_escape(r["designation"]), csv_escape(r["industry"]),
            csv_escape(r["joining_month"]), csv_escape(r["joining_year"]), csv_escape(r["status"]),
            csv_escape(r["linkedin_url"]), csv_escape(r["created_at"].strftime("%Y-%m-%d")),
        ]))
    csv = "﻿" + "\r\n".join(lines)

    from datetime import datetime
    date_stamp = datetime.now().strftime("%Y-%m-%d")
    return PlainTextResponse(
        csv, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="alumni-export-{date_stamp}.csv"'},
    )


@router.patch("/{user_id}", dependencies=[staff_only])
async def update_user(user_id: int, request: Request):
    body = await request.json()
    pool = get_pool()

    prior_status = None
    if "status" in body:
        prior = await pool.fetchrow("SELECT status FROM users WHERE id = $1", user_id)
        prior_status = prior["status"] if prior else None

    set_clauses = []
    values: list = []
    for body_key, column in FIELD_MAP.items():
        if body_key not in body:
            continue
        value = body[body_key]
        if body_key == "joiningYear":
            value = int(value) if value not in (None, "") else None
        if body_key == "linkedinUrl":
            value = str(value).strip() or None
            if value is not None and not LINKEDIN_URL_RE.match(value):
                raise HTTPException(status_code=400, detail="LinkedIn URL must be a full URL, e.g. https://linkedin.com/in/yourprofile.")
        values.append(value)
        set_clauses.append(f"{column} = ${len(values)}")

    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")

    values.append(user_id)
    row = await pool.fetchrow(
        f"UPDATE users SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING {USER_FIELDS}",
        *values,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="User not found.")

    new_status = body.get("status")
    if new_status and new_status != prior_status:
        if new_status == "active" and prior_status == "inactive":
            notif = ("account", "Account Reactivated", "Your alumni account has been reactivated. Welcome back!", "/portal/dashboard")
        else:
            notif = STATUS_NOTIFICATIONS.get(new_status)
        if notif:
            try:
                await create_notification(user_id, notif[0], notif[1], notif[2], notif[3])
            except Exception:
                pass

        if prior_status == "pending" and new_status == "active":
            action_label = "Registration Approved"
        elif prior_status == "pending" and new_status == "rejected":
            action_label = "Registration Rejected"
        elif new_status == "inactive":
            action_label = "Account Deactivated"
        elif new_status == "active" and prior_status == "inactive":
            action_label = "Account Reactivated"
        else:
            action_label = f"Status changed to {new_status}"

        staff_token = request.cookies.get(SESSION_COOKIE)
        staff_session = verify_session_token(staff_token) if staff_token else None
        actor_label = staff_session["email"] if staff_session and staff_session["role"] in ("hr", "admin") else "HR Staff"

        try:
            await log_audit("staff", actor_label, action_label, "registrations", "success", request)
        except Exception:
            pass

    return {"user": dict(row)}


@router.delete("/{user_id}", dependencies=[staff_only])
async def delete_user(user_id: int):
    result = await get_pool().execute("DELETE FROM users WHERE id = $1", user_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"success": True}
