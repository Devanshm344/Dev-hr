import asyncio
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

import asyncpg
from core.auth import hash_password
from core.db import get_pool
from core.deps import require_role
from core.metrics import ensure_metrics_sampler, get_current_cpu_usage_pct, get_current_memory_usage_pct
from core.settings_cache import get_password_min_length, get_system_settings
from core.sql_utils import affected_count

router = APIRouter(prefix="/api/admin")

admin_only = Depends(require_role("admin"))


def pct_change(current: int, previous: int) -> int:
    if previous == 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100)


def csv_escape(value) -> str:
    if value is None:
        return ""
    s = str(value)
    if any(c in s for c in [",", '"', "\n"]):
        return '"' + s.replace('"', '""') + '"'
    return s


@router.get("/dashboard", dependencies=[admin_only])
async def dashboard():
    pool = get_pool()
    users, staff, staff_by_role, staff_preview, alumni_count, roles_count, role_breakdown, audit = await asyncio.gather(
        pool.fetchrow("SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS this_month FROM users WHERE status != 'system'"),
        pool.fetchrow("SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS this_month FROM staff_users"),
        pool.fetch("SELECT role, count(*)::int AS count FROM staff_users GROUP BY role"),
        pool.fetch("""
            SELECT s.id, s.full_name, s.email, s.role, s.active, r.name AS role_name
            FROM staff_users s LEFT JOIN roles r ON r.id = s.role_id
            ORDER BY s.created_at ASC LIMIT 5
        """),
        pool.fetchval("SELECT count(*)::int FROM users WHERE status = 'active'"),
        pool.fetchval("SELECT count(*)::int FROM roles"),
        pool.fetch("""
            SELECT r.name, count(s.id)::int AS count
            FROM roles r LEFT JOIN staff_users s ON s.role_id = r.id
            GROUP BY r.name ORDER BY r.name ASC
        """),
        pool.fetchrow("""
            SELECT
              count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS total_24h,
              count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '24 hours')::int AS failed_24h,
              count(*) FILTER (WHERE created_at >= now() - interval '48 hours' AND created_at < now() - interval '24 hours')::int AS prior_24h
            FROM audit_logs
        """),
    )

    hr_count = next((r["count"] for r in staff_by_role if r["role"] == "hr"), 0)
    combined_total = users["total"] + staff["total"]
    combined_this_month = users["this_month"] + staff["this_month"]
    combined_prior = combined_total - combined_this_month

    return {
        "totalUsers": {"value": combined_total, "alumniCount": users["total"], "staffCount": staff["total"], "trend": pct_change(combined_this_month, combined_prior)},
        "hrUsers": {"value": hr_count, "trend": 0},
        "activeRoles": {"value": roles_count},
        "auditEvents": {"value": audit["total_24h"], "failedCount": audit["failed_24h"], "trend": pct_change(audit["total_24h"], audit["prior_24h"])},
        "usersByRole": [{"name": "Alumni", "users": alumni_count}] + [{"name": r["name"], "users": r["count"]} for r in role_breakdown],
        "staffPreview": [{"id": r["id"], "fullName": r["full_name"], "email": r["email"], "role": r["role"], "roleName": r["role_name"], "active": r["active"]} for r in staff_preview],
    }


@router.get("/roles", dependencies=[admin_only])
async def list_roles():
    rows = await get_pool().fetch("""
        SELECT r.id, r.name, r.description, r.base_role, r.permissions, r.created_at, COALESCE(s.count, 0)::int AS users
        FROM roles r LEFT JOIN (SELECT role_id, count(*) AS count FROM staff_users GROUP BY role_id) s ON s.role_id = r.id
        ORDER BY r.created_at ASC
    """)
    return {"roles": [dict(r) for r in rows]}


@router.post("/roles", status_code=201, dependencies=[admin_only])
async def create_role(request: Request):
    body = await request.json()
    name = str(body.get("name") or "").strip()
    description = str(body.get("description") or "").strip()
    base_role = str(body.get("baseRole") or "").strip()
    permissions = [str(p) for p in body.get("permissions")] if isinstance(body.get("permissions"), list) else []

    if not name:
        raise HTTPException(status_code=400, detail="Role name is required.")
    if base_role not in ("hr", "admin"):
        raise HTTPException(status_code=400, detail="Portal access must be either HR or Admin.")

    try:
        row = await get_pool().fetchrow(
            "INSERT INTO roles (name, description, base_role, permissions) VALUES ($1,$2,$3,$4::jsonb) RETURNING *",
            name, description or None, base_role, permissions,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="A role with this name already exists.")
    return {"role": dict(row)}


@router.patch("/roles/{role_id}", dependencies=[admin_only])
async def update_role(role_id: int, request: Request):
    body = await request.json()
    field_map = {"name": "name", "description": "description", "baseRole": "base_role"}
    set_clauses = []
    values: list = []
    for body_key, column in field_map.items():
        if body_key in body:
            values.append(body[body_key])
            set_clauses.append(f"{column} = ${len(values)}")
    if "permissions" in body:
        permissions = [str(p) for p in body["permissions"]] if isinstance(body["permissions"], list) else []
        values.append(permissions)
        set_clauses.append(f"permissions = ${len(values)}::jsonb")

    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")

    values.append(role_id)
    try:
        row = await get_pool().fetchrow(
            f"UPDATE roles SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="A role with this name already exists.")
    if row is None:
        raise HTTPException(status_code=404, detail="Role not found.")
    return {"role": dict(row)}


@router.delete("/roles/{role_id}", dependencies=[admin_only])
async def delete_role(role_id: int):
    pool = get_pool()
    staff_count = await pool.fetchval("SELECT count(*)::int FROM staff_users WHERE role_id = $1", role_id)
    if staff_count > 0:
        plural = "" if staff_count == 1 else "s"
        raise HTTPException(status_code=409, detail=f"This role has {staff_count} staff member{plural} assigned and can't be deleted — reassign them first.")
    result = await pool.execute("DELETE FROM roles WHERE id = $1", role_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Role not found.")
    return {"success": True}


@router.get("/audit-logs", dependencies=[admin_only])
async def audit_logs(
    search: Optional[str] = None, status: Optional[str] = None, eventType: Optional[str] = None,
    page: int = Query(1), pageSize: int = Query(25),
):
    page = max(1, page)
    page_size = min(100, max(1, pageSize))
    conditions = []
    params: list = []
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"(actor_label ILIKE ${len(params)} OR action ILIKE ${len(params)} OR resource ILIKE ${len(params)})")
    if status in ("success", "failed"):
        params.append(status)
        conditions.append(f"status = ${len(params)}")
    if eventType == "login":
        conditions.append("resource = 'auth'")
    elif eventType == "admin":
        conditions.append("resource = 'registrations'")
    elif eventType == "failed":
        conditions.append("status = 'failed'")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    pool = get_pool()
    total = await pool.fetchval(f"SELECT count(*)::int FROM audit_logs {where}", *params)

    data_params = [*params, page_size, (page - 1) * page_size]
    logs = await pool.fetch(
        f"""SELECT id, actor_type, actor_label, action, resource, status, ip_address, created_at
            FROM audit_logs {where} ORDER BY created_at DESC LIMIT ${len(data_params) - 1} OFFSET ${len(data_params)}""",
        *data_params,
    )

    stats, alerts = await asyncio.gather(
        pool.fetchrow("""
            SELECT count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hours')::int AS successful_24h,
                   count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '24 hours')::int AS failed_24h
            FROM audit_logs
        """),
        pool.fetch("""
            SELECT actor_label, ip_address, count(*)::int AS count, max(created_at) AS last_attempt
            FROM audit_logs
            WHERE status = 'failed' AND action = 'Login' AND created_at >= now() - interval '24 hours'
            GROUP BY actor_label, ip_address HAVING count(*) >= 3 ORDER BY count(*) DESC
        """),
    )

    return {
        "logs": [dict(r) for r in logs], "total": total, "page": page, "pageSize": page_size,
        "stats": {"successful24h": stats["successful_24h"], "failed24h": stats["failed_24h"], "alerts": len(alerts)},
        "alertDetails": [dict(r) for r in alerts],
    }


@router.get("/audit-logs/export", dependencies=[admin_only])
async def audit_logs_export():
    rows = await get_pool().fetch(
        "SELECT actor_type, actor_label, action, resource, status, ip_address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 1000"
    )
    headers = ["Actor Type", "Actor", "Action", "Resource", "Status", "IP Address", "Timestamp"]
    lines = [",".join(headers)]
    for r in rows:
        lines.append(",".join([
            csv_escape(r["actor_type"]), csv_escape(r["actor_label"]), csv_escape(r["action"]),
            csv_escape(r["resource"]), csv_escape(r["status"]), csv_escape(r["ip_address"]),
            csv_escape(r["created_at"].isoformat()),
        ]))
    csv = "﻿" + "\r\n".join(lines)
    date_stamp = datetime.now().strftime("%Y-%m-%d")
    return PlainTextResponse(csv, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="audit-logs-{date_stamp}.csv"'})


@router.get("/system-metrics", dependencies=[admin_only])
async def system_metrics():
    ensure_metrics_sampler()
    pool = get_pool()
    current_cpu, history = await asyncio.gather(
        get_current_cpu_usage_pct(),
        pool.fetch("""
            SELECT to_char(created_at, 'HH24:MI') AS time, cpu_pct, memory_pct
            FROM system_metrics_samples WHERE created_at >= now() - interval '24 hours' ORDER BY created_at ASC
        """),
    )
    current_memory = get_current_memory_usage_pct()
    return {
        "current": {"cpu": current_cpu, "memory": current_memory},
        "history": [{"time": r["time"], "cpu": float(r["cpu_pct"]), "memory": float(r["memory_pct"])} for r in history],
    }


@router.get("/system-status")
async def system_status():
    pool = get_pool()
    database_operational = True
    try:
        await pool.fetchval("SELECT 1")
    except Exception:
        database_operational = False

    cpu, memory = await asyncio.gather(get_current_cpu_usage_pct(150), asyncio.to_thread(get_current_memory_usage_pct))
    return {"webApplication": {"operational": True}, "database": {"operational": database_operational}, "cpu": cpu, "memory": memory}


@router.get("/reports", dependencies=[admin_only])
async def admin_reports(year: Optional[int] = Query(None)):
    year = year or datetime.now().year
    year_start = date(year, 1, 1)
    year_end = date(year + 1, 1, 1)
    prev_year_start = date(year - 1, 1, 1)
    year_start_ts = datetime(year, 1, 1)
    year_end_ts = datetime(year + 1, 1, 1)
    prev_year_start_ts = datetime(year - 1, 1, 1)
    now = datetime.now()
    is_current_year = year == now.year
    last_month_index = now.month - 1 if is_current_year else 11

    pool = get_pool()
    (users, staff, alumni_growth, benefit_requests, events_hosted, baseline, monthly_growth,
     alumni_total, role_breakdown, login_activity) = await asyncio.gather(
        pool.fetchrow("SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS this_month FROM users WHERE status != 'system'"),
        pool.fetchrow("SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS this_month FROM staff_users"),
        pool.fetchrow("SELECT count(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS this_year, count(*) FILTER (WHERE created_at >= $3 AND created_at < $1)::int AS prev_year FROM users WHERE status != 'system'", year_start_ts, year_end_ts, prev_year_start_ts),
        pool.fetchrow("SELECT count(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS this_year, count(*) FILTER (WHERE created_at >= $3 AND created_at < $1)::int AS prev_year FROM service_requests", year_start_ts, year_end_ts, prev_year_start_ts),
        pool.fetchrow("SELECT count(*) FILTER (WHERE event_date >= $1 AND event_date < $2)::int AS this_year, count(*) FILTER (WHERE event_date >= $3 AND event_date < $1)::int AS prev_year FROM events", year_start, year_end, prev_year_start),
        pool.fetchval("SELECT count(*)::int FROM users WHERE status != 'system' AND created_at < $1", year_start_ts),
        pool.fetch("SELECT date_trunc('month', created_at) AS month, count(*)::int AS count FROM users WHERE status != 'system' AND created_at >= $1 AND created_at < $2 GROUP BY 1 ORDER BY 1", year_start_ts, year_end_ts),
        pool.fetchval("SELECT count(*)::int FROM users WHERE status = 'active'"),
        pool.fetch("SELECT r.name, count(s.id)::int AS count FROM roles r LEFT JOIN staff_users s ON s.role_id = r.id GROUP BY r.name ORDER BY r.name ASC"),
        pool.fetch("SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS count FROM audit_logs WHERE action = 'Login' AND status = 'success' AND created_at >= now() - interval '7 days' GROUP BY 1 ORDER BY 1"),
    )

    combined_total = users["total"] + staff["total"]
    combined_this_month = users["this_month"] + staff["this_month"]
    combined_prior = combined_total - combined_this_month

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_map = {r["month"].month - 1: r["count"] for r in monthly_growth}
    cumulative = baseline
    user_growth = []
    for m in range(0, last_month_index + 1):
        cumulative += monthly_map.get(m, 0)
        user_growth.append({"month": month_names[m], "alumni": cumulative})

    role_colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"]
    role_distribution = [{"name": "Alumni", "value": alumni_total, "color": role_colors[0]}]
    for i, r in enumerate(role_breakdown):
        role_distribution.append({"name": r["name"], "value": r["count"], "color": role_colors[(i + 1) % len(role_colors)]})

    login_map = {r["day"]: r["count"] for r in login_activity}
    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    login_activity_out = []
    from datetime import timedelta
    for i in range(6, -1, -1):
        d = now - timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        login_activity_out.append({"day": day_labels[d.weekday()], "logins": login_map.get(key, 0)})

    return {
        "year": year,
        "totalUsers": {"value": combined_total, "trend": pct_change(combined_this_month, combined_prior)},
        "alumniGrowth": {"value": alumni_growth["this_year"], "trend": pct_change(alumni_growth["this_year"], alumni_growth["prev_year"])},
        "benefitRequests": {"value": benefit_requests["this_year"], "trend": pct_change(benefit_requests["this_year"], benefit_requests["prev_year"])},
        "eventsHosted": {"value": events_hosted["this_year"], "trend": pct_change(events_hosted["this_year"], events_hosted["prev_year"])},
        "userGrowth": user_growth,
        "roleDistribution": role_distribution,
        "loginActivity": login_activity_out,
    }


@router.get("/reports/export", dependencies=[admin_only])
async def admin_reports_export(year: Optional[int] = Query(None)):
    year = year or datetime.now().year
    year_start = date(year, 1, 1)
    year_end = date(year + 1, 1, 1)
    year_start_ts = datetime(year, 1, 1)
    year_end_ts = datetime(year + 1, 1, 1)

    pool = get_pool()
    users_total, staff_total, alumni_growth, benefit_requests, events_hosted, role_breakdown, alumni_total = await asyncio.gather(
        pool.fetchval("SELECT count(*)::int FROM users WHERE status != 'system'"),
        pool.fetchval("SELECT count(*)::int FROM staff_users"),
        pool.fetchval("SELECT count(*)::int FROM users WHERE status != 'system' AND created_at >= $1 AND created_at < $2", year_start_ts, year_end_ts),
        pool.fetchval("SELECT count(*)::int FROM service_requests WHERE created_at >= $1 AND created_at < $2", year_start_ts, year_end_ts),
        pool.fetchval("SELECT count(*)::int FROM events WHERE event_date >= $1 AND event_date < $2", year_start, year_end),
        pool.fetch("SELECT r.name, count(s.id)::int AS count FROM roles r LEFT JOIN staff_users s ON s.role_id = r.id GROUP BY r.name ORDER BY r.name ASC"),
        pool.fetchval("SELECT count(*)::int FROM users WHERE status = 'active'"),
    )

    lines = [
        "Metric,Value",
        f"{csv_escape('Report Year')},{csv_escape(year)}",
        f"{csv_escape('Total Users')},{csv_escape(users_total + staff_total)}",
        f"{csv_escape(f'Alumni Growth ({year})')},{csv_escape(alumni_growth)}",
        f"{csv_escape(f'Benefit Requests ({year})')},{csv_escape(benefit_requests)}",
        f"{csv_escape(f'Events Hosted ({year})')},{csv_escape(events_hosted)}",
        "", "Role,Users",
        f"{csv_escape('Alumni')},{csv_escape(alumni_total)}",
    ]
    for r in role_breakdown:
        lines.append(f"{csv_escape(r['name'])},{csv_escape(r['count'])}")

    csv = "﻿" + "\r\n".join(lines)
    return PlainTextResponse(csv, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="reports-{year}.csv"'})


SETTINGS_FIELD_MAP = {
    "portalName": "portal_name", "organizationName": "organization_name", "supportEmail": "support_email",
    "defaultTimezone": "default_timezone", "enablePublicLandingPage": "enable_public_landing_page",
    "allowNewRegistrations": "allow_new_registrations", "showAlumniStatsOnLanding": "show_alumni_stats_on_landing",
    "passwordMinLength": "password_min_length", "sessionTimeoutMinutes": "session_timeout_minutes",
    "maintenanceMode": "maintenance_mode",
}


@router.get("/system-settings", dependencies=[admin_only])
async def get_admin_system_settings():
    return {"settings": await get_system_settings()}


@router.patch("/system-settings", dependencies=[admin_only])
async def patch_admin_system_settings(request: Request):
    body = await request.json()
    set_clauses = []
    values: list = []
    for body_key, column in SETTINGS_FIELD_MAP.items():
        if body_key in body:
            values.append(body[body_key])
            set_clauses.append(f"{column} = ${len(values)}")

    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")
    if "passwordMinLength" in body and not (6 <= int(body["passwordMinLength"]) <= 64):
        raise HTTPException(status_code=400, detail="Password minimum length must be between 6 and 64.")
    if "sessionTimeoutMinutes" in body and not (5 <= int(body["sessionTimeoutMinutes"]) <= 43200):
        raise HTTPException(status_code=400, detail="Session timeout must be between 5 and 43200 minutes.")

    await get_pool().execute(f"UPDATE system_settings SET {', '.join(set_clauses)}, updated_at = now() WHERE id = 1", *values)
    return {"settings": await get_system_settings()}


@router.get("/staff-users", dependencies=[admin_only])
async def list_staff_users(search: Optional[str] = None):
    conditions = []
    params: list = []
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"(s.full_name ILIKE ${len(params)} OR s.email ILIKE ${len(params)})")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = await get_pool().fetch(
        f"""SELECT s.id, s.full_name, s.email, s.role, s.active, s.created_at,
                   r.id AS role_id, r.name AS role_name,
                   (SELECT max(a.created_at) FROM audit_logs a WHERE a.actor_label = s.email AND a.action = 'Login' AND a.status = 'success') AS last_login
            FROM staff_users s LEFT JOIN roles r ON r.id = s.role_id
            {where} ORDER BY s.created_at ASC""",
        *params,
    )
    return {"staff": [dict(r) for r in rows]}


@router.post("/staff-users", status_code=201, dependencies=[admin_only])
async def create_staff_user(request: Request):
    body = await request.json()
    full_name = str(body.get("fullName") or "").strip()
    email = str(body.get("email") or "").strip()
    password = str(body.get("password") or "")
    try:
        role_id = int(body.get("roleId"))
    except (TypeError, ValueError):
        role_id = None

    import re
    if not full_name or not role_id or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(status_code=400, detail="Name, a valid email, and a role are required.")
    min_length = await get_password_min_length()
    if len(password) < min_length:
        raise HTTPException(status_code=400, detail=f"Password must be at least {min_length} characters.")

    pool = get_pool()
    role = await pool.fetchrow("SELECT base_role FROM roles WHERE id = $1", role_id)
    if not role:
        raise HTTPException(status_code=400, detail="Selected role no longer exists.")

    password_hash = await hash_password(password)
    try:
        row = await pool.fetchrow(
            """INSERT INTO staff_users (full_name, email, password_hash, role, role_id, active)
               VALUES ($1,$2,$3,$4,$5,true) RETURNING id, full_name, email, role, active, created_at""",
            full_name, email, password_hash, role["base_role"], role_id,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="A staff account with this email already exists.")
    return {"staff": dict(row)}


@router.patch("/staff-users/{staff_id}", dependencies=[admin_only])
async def update_staff_user(staff_id: int, request: Request):
    body = await request.json()
    set_clauses = []
    values: list = []
    pool = get_pool()

    if "fullName" in body:
        values.append(str(body["fullName"]).strip())
        set_clauses.append(f"full_name = ${len(values)}")
    if "email" in body:
        values.append(str(body["email"]).strip())
        set_clauses.append(f"email = ${len(values)}")
    if "active" in body:
        values.append(body["active"] is True)
        set_clauses.append(f"active = ${len(values)}")
    if "roleId" in body:
        try:
            role_id = int(body["roleId"])
        except (TypeError, ValueError):
            role_id = None
        role = await pool.fetchrow("SELECT base_role FROM roles WHERE id = $1", role_id) if role_id else None
        if not role:
            raise HTTPException(status_code=400, detail="Selected role no longer exists.")
        values.append(role_id)
        set_clauses.append(f"role_id = ${len(values)}")
        values.append(role["base_role"])
        set_clauses.append(f"role = ${len(values)}")
    if "newPassword" in body:
        new_password = str(body.get("newPassword") or "")
        min_length = await get_password_min_length()
        if len(new_password) < min_length:
            raise HTTPException(status_code=400, detail=f"Password must be at least {min_length} characters.")
        values.append(await hash_password(new_password))
        set_clauses.append(f"password_hash = ${len(values)}")

    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")

    values.append(staff_id)
    try:
        row = await pool.fetchrow(
            f"UPDATE staff_users SET {', '.join(set_clauses)} WHERE id = ${len(values)} RETURNING id, full_name, email, role, role_id, active, created_at",
            *values,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="A staff account with this email already exists.")
    if row is None:
        raise HTTPException(status_code=404, detail="Staff account not found.")
    return {"staff": dict(row)}


@router.delete("/staff-users/{staff_id}", dependencies=[admin_only])
async def delete_staff_user(staff_id: int):
    result = await get_pool().execute("DELETE FROM staff_users WHERE id = $1", staff_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Staff account not found.")
    return {"success": True}
