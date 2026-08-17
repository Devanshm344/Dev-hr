import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, Response
from starlette.datastructures import UploadFile as StarletteUploadFile

from core import storage
from core.audit import log_audit
from core.db import get_pool
from core.deps import require_role
from core.notifications import create_notification

router = APIRouter(prefix="/api/hr")

hr_only = Depends(require_role("hr", "admin"))

MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
CATEGORY_COLORS = {
    "Career": "#3b82f6", "Education": "#10b981", "Networking": "#f59e0b", "Wellness": "#ef4444",
    "Lifestyle": "#8b5cf6", "Financial": "#06b6d4", "Recognition": "#ec4899",
}


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


@router.get("/dashboard", dependencies=[hr_only])
async def dashboard():
    pool = get_pool()
    pending_reg, active_alumni, active_requests, events, monthly, pending_list, top_benefits = await asyncio.gather(
        pool.fetchrow("""
            SELECT
              count(*) FILTER (WHERE status = 'pending')::int AS pending_total,
              count(*) FILTER (WHERE status = 'pending' AND created_at >= now() - interval '7 days')::int AS pending_this_week,
              count(*) FILTER (WHERE status = 'pending' AND created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days')::int AS pending_prev_week
            FROM users
        """),
        pool.fetchrow("""
            SELECT
              count(*) FILTER (WHERE status = 'active')::int AS active_total,
              count(*) FILTER (WHERE status = 'active' AND created_at >= date_trunc('month', now()))::int AS active_this_month
            FROM users
        """),
        pool.fetchrow("""
            SELECT
              count(*)::int AS active_requests,
              count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS this_week,
              count(*) FILTER (WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days')::int AS prev_week
            FROM service_requests
        """),
        pool.fetchrow("""
            SELECT
              count(*) FILTER (WHERE date_trunc('month', event_date) = date_trunc('month', now()))::int AS this_month,
              count(*) FILTER (WHERE date_trunc('month', event_date) = date_trunc('month', now()) AND status = 'upcoming')::int AS upcoming_this_month,
              count(*) FILTER (WHERE date_trunc('month', event_date) = date_trunc('month', now()) - interval '1 month')::int AS last_month
            FROM events
        """),
        pool.fetch("""
            WITH months AS (
              SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
              FROM generate_series(3, 0, -1) AS n
            )
            SELECT
              to_char(month_start, 'Mon') AS month,
              (SELECT count(*)::int FROM users u WHERE u.status != 'system' AND date_trunc('month', u.created_at) = months.month_start) AS registrations,
              (SELECT count(*)::int FROM users u WHERE u.status = 'active' AND u.created_at < months.month_start + interval '1 month') AS alumni
            FROM months ORDER BY month_start
        """),
        pool.fetch("SELECT id, full_name, employer, designation, profile_photo_path FROM users WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5"),
        pool.fetch("SELECT benefit_title, count(*)::int AS count FROM service_requests GROUP BY benefit_title ORDER BY count DESC LIMIT 5"),
    )

    return {
        "stats": {
            "pendingRegistrations": {
                "value": pending_reg["pending_total"],
                "subtitle": f'{pending_reg["pending_this_week"]} new this week',
                "trend": pct_change(pending_reg["pending_this_week"], pending_reg["pending_prev_week"]),
                "trendLabel": "vs last week",
            },
            "totalAlumni": {
                "value": active_alumni["active_total"],
                "subtitle": "Active members",
                "trend": pct_change(active_alumni["active_this_month"], active_alumni["active_total"] - active_alumni["active_this_month"]),
                "trendLabel": "this month",
            },
            "activeRequests": {
                "value": active_requests["active_requests"],
                "subtitle": "Alumni conversations",
                "trend": pct_change(active_requests["this_week"], active_requests["prev_week"]),
                "trendLabel": "vs last week",
            },
            "eventsThisMonth": {
                "value": events["this_month"],
                "subtitle": f'{events["upcoming_this_month"]} upcoming',
                "trend": pct_change(events["this_month"], events["last_month"]),
                "trendLabel": "vs last month",
            },
        },
        "monthlyData": [dict(r) for r in monthly],
        "pendingRegistrationsList": [dict(r) for r in pending_list],
        "topBenefits": [dict(r) for r in top_benefits],
    }


@router.get("/networking", dependencies=[hr_only])
async def networking(search: Optional[str] = None):
    pool = get_pool()
    search_clause = "AND (u.full_name ILIKE $1 OR u.employer ILIKE $1)" if search and search.strip() else ""
    alumni_params = [f"%{search.strip()}%"] if search and search.strip() else []

    stats, alumni = await asyncio.gather(
        pool.fetchrow("""
            SELECT
              (SELECT count(*)::int FROM connections WHERE status = 'accepted') AS total_connections,
              (SELECT count(DISTINCT user_id)::int FROM (
                SELECT requester_id AS user_id FROM connections WHERE status = 'accepted'
                UNION
                SELECT recipient_id AS user_id FROM connections WHERE status = 'accepted'
              ) t) AS active_networkers
        """),
        pool.fetch(
            f"""SELECT u.id, u.full_name, u.employer, u.industry, u.status,
                       COALESCE(c.count, 0)::int AS connections
                FROM users u
                LEFT JOIN (
                  SELECT user_id, count(*) AS count FROM (
                    SELECT requester_id AS user_id FROM connections WHERE status = 'accepted'
                    UNION ALL
                    SELECT recipient_id AS user_id FROM connections WHERE status = 'accepted'
                  ) t GROUP BY user_id
                ) c ON c.user_id = u.id
                WHERE u.status IN ('active', 'inactive', 'pending')
                {search_clause}
                ORDER BY connections DESC, u.full_name ASC""",
            *alumni_params,
        ),
    )
    return {"stats": dict(stats), "alumni": [dict(r) for r in alumni]}


async def _reports_data(year: int):
    prev_year = year - 1
    pool = get_pool()
    years_rows, alumni_growth, benefit_usage, event_kpi, monthly, category, event_list = await asyncio.gather(
        pool.fetch("""
            SELECT DISTINCT y FROM (
              SELECT extract(year from created_at)::int AS y FROM users WHERE status != 'system'
              UNION SELECT extract(year from event_date)::int AS y FROM events
              UNION SELECT extract(year from created_at)::int AS y FROM service_requests
            ) t ORDER BY y DESC
        """),
        pool.fetchrow("""
            SELECT count(*) FILTER (WHERE extract(year from created_at) = $1)::int AS current,
                   count(*) FILTER (WHERE extract(year from created_at) = $2)::int AS previous
            FROM users WHERE status != 'system'
        """, year, prev_year),
        pool.fetchrow("""
            SELECT count(*) FILTER (WHERE extract(year from created_at) = $1)::int AS current,
                   count(*) FILTER (WHERE extract(year from created_at) = $2)::int AS previous
            FROM service_requests
        """, year, prev_year),
        pool.fetchrow("""
            SELECT COALESCE(sum(r.count) FILTER (WHERE extract(year from e.event_date) = $1), 0)::int AS current,
                   COALESCE(sum(r.count) FILTER (WHERE extract(year from e.event_date) = $2), 0)::int AS previous
            FROM events e LEFT JOIN (SELECT event_id, count(*) AS count FROM event_rsvps GROUP BY event_id) r ON r.event_id = e.id
        """, year, prev_year),
        pool.fetch("""
            SELECT m,
              (SELECT count(*)::int FROM users u WHERE u.status != 'system' AND extract(year from u.created_at) = $1 AND extract(month from u.created_at) = m) AS registrations,
              (SELECT count(*)::int FROM users u WHERE u.status = 'active' AND u.created_at < make_date($1::int, m::int, 1) + interval '1 month') AS alumni
            FROM generate_series(1, 12) AS m ORDER BY m
        """, year),
        pool.fetch("""
            SELECT b.category AS name, count(*)::int AS count
            FROM service_requests sr JOIN benefits b ON b.id = sr.benefit_id
            WHERE extract(year from sr.created_at) = $1 GROUP BY b.category ORDER BY count DESC
        """, year),
        pool.fetch("""
            SELECT e.title AS event, e.event_date, COALESCE(r.count, 0)::int AS attendees
            FROM events e LEFT JOIN (SELECT event_id, count(*) AS count FROM event_rsvps GROUP BY event_id) r ON r.event_id = e.id
            WHERE extract(year from e.event_date) = $1 ORDER BY e.event_date ASC
        """, year),
    )
    return years_rows, alumni_growth, benefit_usage, event_kpi, monthly, category, event_list


@router.get("/reports", dependencies=[hr_only])
async def reports(year: Optional[int] = Query(None)):
    current_year = datetime.now().year
    year = max(2000, year or current_year)

    years_rows, alumni_growth, benefit_usage, event_kpi, monthly, category, event_list = await _reports_data(year)

    years = [r["y"] for r in years_rows]
    if current_year not in years:
        years.insert(0, current_year)

    total_category_count = sum(r["count"] for r in category)
    benefit_categories = [
        {"name": r["name"], "value": round((r["count"] / total_category_count) * 100) if total_category_count else 0, "color": CATEGORY_COLORS.get(r["name"], "#94a3b8")}
        for r in category
    ]

    return {
        "years": years,
        "kpis": {
            "alumniGrowth": {"value": alumni_growth["current"], "trend": pct_change(alumni_growth["current"], alumni_growth["previous"])},
            "benefitUsage": {"value": benefit_usage["current"], "trend": pct_change(benefit_usage["current"], benefit_usage["previous"])},
            "eventAttendance": {"value": event_kpi["current"], "trend": pct_change(event_kpi["current"], event_kpi["previous"])},
        },
        "monthlyGrowth": [{"month": MONTHS[r["m"] - 1], "registrations": r["registrations"], "alumni": r["alumni"]} for r in monthly],
        "benefitCategories": benefit_categories,
        "eventAttendance": [dict(r) for r in event_list],
    }


@router.get("/reports/export", dependencies=[hr_only])
async def reports_export(year: Optional[int] = Query(None)):
    year = max(2000, year or datetime.now().year)
    _, _, _, _, monthly, category, event_list = await _reports_data(year)

    lines = [f"Alumni Reports & Analytics - {year}", "", "Monthly Alumni Growth", "Month,New Registrations,Total Active Alumni"]
    for r in monthly:
        lines.append(f'{MONTHS[r["m"] - 1]},{r["registrations"]},{r["alumni"]}')
    lines += ["", "Benefit Category Distribution", "Category,Requests"]
    for r in category:
        lines.append(f'{csv_escape(r["name"])},{r["count"]}')
    lines += ["", "Event Attendance", "Event,Date,Attendees"]
    for r in event_list:
        lines.append(f'{csv_escape(r["event"])},{r["event_date"].strftime("%Y-%m-%d")},{r["attendees"]}')

    csv = "﻿" + "\r\n".join(lines)
    return PlainTextResponse(
        csv, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="alumni-report-{year}.csv"'},
    )


@router.get("/alumni/{alumni_id}/documents", dependencies=[hr_only])
async def list_alumni_documents(alumni_id: int):
    rows = await get_pool().fetch(
        """SELECT id, doc_type, period_label, original_filename, file_size_bytes, uploaded_at
           FROM alumni_documents WHERE alumni_id = $1 ORDER BY uploaded_at DESC""",
        alumni_id,
    )
    return {"documents": [dict(r) for r in rows]}


@router.post("/alumni/{alumni_id}/documents")
async def upload_alumni_documents(alumni_id: int, request: Request, staff: dict = hr_only):
    pool = get_pool()
    alumni = await pool.fetchrow("SELECT id FROM users WHERE id = $1", alumni_id)
    if alumni is None:
        raise HTTPException(status_code=404, detail="Alumni not found.")

    form = await request.form()
    period_label = str(form.get("periodLabel") or "").strip() or None
    files = [f for f in form.getlist("files") if isinstance(f, StarletteUploadFile) and f.filename]
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    inserted_ids = []
    for file in files:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail=f'"{file.filename}" is not a PDF file.')
        data = await file.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f'"{file.filename}" is empty.')
        if len(data) > MAX_DOCUMENT_SIZE_BYTES:
            raise HTTPException(status_code=400, detail=f'"{file.filename}" exceeds the 10MB limit.')

        storage_key = storage.save_file(data, "salary_certificates", "pdf")
        doc_id = await pool.fetchval(
            """INSERT INTO alumni_documents (alumni_id, doc_type, period_label, original_filename, storage_key, file_size_bytes, uploaded_by)
               VALUES ($1, 'salary_certificate', $2, $3, $4, $5, $6) RETURNING id""",
            alumni_id, period_label, file.filename, storage_key, len(data), staff["id"],
        )
        inserted_ids.append(doc_id)

    try:
        await create_notification(
            alumni_id, "document", "New Salary Certificate Available",
            f"HR has added {len(inserted_ids)} new document(s) to your Documents.", "/portal/documents",
        )
    except Exception:
        pass
    try:
        await log_audit("staff", staff["email"], "Uploaded Salary Certificate", "documents", "success", request)
    except Exception:
        pass

    return {"ids": inserted_ids}


@router.get("/documents/{document_id}/download", dependencies=[hr_only])
async def hr_download_document(document_id: int):
    row = await get_pool().fetchrow(
        "SELECT storage_key, original_filename FROM alumni_documents WHERE id = $1", document_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    data = storage.read_file(row["storage_key"])
    return Response(
        content=data, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{row["original_filename"]}"'},
    )


@router.delete("/documents/{document_id}", dependencies=[hr_only])
async def delete_alumni_document(document_id: int):
    row = await get_pool().fetchrow("SELECT storage_key FROM alumni_documents WHERE id = $1", document_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    await get_pool().execute("DELETE FROM alumni_documents WHERE id = $1", document_id)
    storage.delete_file(row["storage_key"])
    return {"success": True}
