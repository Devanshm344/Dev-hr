from datetime import date
from secrets import token_hex
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.datastructures import UploadFile as StarletteUploadFile

from core.config import PROJECT_ROOT
from core.db import get_pool
from core.deps import get_optional_user_id, get_staff_role, require_alumni_user_id, require_role
from core.notifications import create_notification
from core.sql_utils import affected_count

router = APIRouter(prefix="/api/events")

staff_only = Depends(require_role("hr", "admin"))

BANNER_DIR = PROJECT_ROOT / "public" / "uploads" / "events"
ALLOWED_BANNER_TYPES = {"image/jpeg", "image/png", "image/webp"}

FIELD_MAP = {
    "title": "title", "eventDate": "event_date", "eventTime": "event_time", "endTime": "end_time",
    "location": "location", "type": "type", "category": "category", "speaker": "speaker",
    "description": "description", "status": "status", "published": "published", "attendees": "attendees",
}


@router.get("")
async def list_events(status: Optional[str] = None, published: Optional[str] = None, limit: Optional[int] = Query(None)):
    conditions = []
    params: list = []
    if status:
        params.append(status)
        conditions.append(f"e.status = ${len(params)}")
    if published is not None:
        params.append(published == "true")
        conditions.append(f"e.published = ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    limit_clause = f"LIMIT {limit or 50}" if limit is not None else ""

    rows = await get_pool().fetch(
        f"""SELECT e.*, COALESCE(r.rsvp_count, 0)::int AS attendees
            FROM events e
            LEFT JOIN (SELECT event_id, COUNT(*) AS rsvp_count FROM event_rsvps GROUP BY event_id) r ON r.event_id = e.id
            {where} ORDER BY e.event_date ASC {limit_clause}""",
        *params,
    )
    return {"events": [dict(r) for r in rows]}


@router.post("", status_code=201, dependencies=[staff_only])
async def create_event(request: Request):
    form = await request.form()
    title = str(form.get("title") or "").strip()
    event_date = str(form.get("eventDate") or "").strip()
    event_time = str(form.get("eventTime") or "").strip() or None
    end_time = str(form.get("endTime") or "").strip() or None
    location = str(form.get("location") or "").strip()
    type_ = str(form.get("type") or "In-Person").strip()
    category = str(form.get("category") or "").strip() or None
    speaker = str(form.get("speaker") or "").strip() or None
    description = str(form.get("description") or "").strip() or None
    published = form.get("published") != "false"

    if not title or not event_date or not location:
        raise HTTPException(status_code=400, detail="Title, date, and location are required.")
    try:
        event_date_value = date.fromisoformat(event_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event date.")

    banner_path = None
    banner = form.get("banner")
    if isinstance(banner, StarletteUploadFile) and banner.size and banner.size > 0:
        if banner.content_type not in ALLOWED_BANNER_TYPES:
            raise HTTPException(status_code=400, detail="Banner must be a JPEG, PNG, or WEBP image.")
        BANNER_DIR.mkdir(parents=True, exist_ok=True)
        ext = (banner.content_type or "image/jpeg").split("/")[-1] or "jpg"
        filename = f"{token_hex(16)}.{ext}"
        (BANNER_DIR / filename).write_bytes(await banner.read())
        banner_path = f"/uploads/events/{filename}"

    row = await get_pool().fetchrow(
        """INSERT INTO events (
            title, event_date, event_time, end_time, location, type, category, speaker, description, banner_path, published
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *""",
        title, event_date_value, event_time, end_time, location, type_, category, speaker, description, banner_path, published,
    )
    return {"event": dict(row)}


@router.patch("/{event_id}", dependencies=[staff_only])
async def update_event(event_id: int, request: Request):
    form = await request.form()
    set_clauses: list[str] = []
    values: list = []

    for form_key, column in FIELD_MAP.items():
        if form_key not in form:
            continue
        value = form.get(form_key)
        if form_key == "published":
            value = value == "true"
        elif form_key == "attendees":
            value = int(value)
        elif form_key == "eventDate":
            try:
                value = date.fromisoformat(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid event date.")
        values.append(value)
        set_clauses.append(f"{column} = ${len(values)}")

    banner = form.get("banner")
    if isinstance(banner, StarletteUploadFile) and banner.size and banner.size > 0:
        if banner.content_type not in ALLOWED_BANNER_TYPES:
            raise HTTPException(status_code=400, detail="Banner must be a JPEG, PNG, or WEBP image.")
        BANNER_DIR.mkdir(parents=True, exist_ok=True)
        ext = (banner.content_type or "image/jpeg").split("/")[-1] or "jpg"
        filename = f"{token_hex(16)}.{ext}"
        (BANNER_DIR / filename).write_bytes(await banner.read())
        values.append(f"/uploads/events/{filename}")
        set_clauses.append(f"banner_path = ${len(values)}")

    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")

    values.append(event_id)
    row = await get_pool().fetchrow(
        f"UPDATE events SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found.")
    return {"event": dict(row)}


@router.delete("/{event_id}", dependencies=[staff_only])
async def delete_event(event_id: int):
    pool = get_pool()
    rsvp_count = await pool.fetchval("SELECT count(*)::int FROM event_rsvps WHERE event_id = $1", event_id)
    if rsvp_count > 0:
        plural = "" if rsvp_count == 1 else "s"
        raise HTTPException(status_code=409, detail=f"This event has {rsvp_count} RSVP{plural} and can't be deleted — cancel it instead.")
    result = await pool.execute("DELETE FROM events WHERE id = $1", event_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Event not found.")
    return {"success": True}


@router.get("/my-rsvps")
async def my_rsvps(user_id: Optional[int] = Depends(get_optional_user_id)):
    if user_id is None:
        return {"eventIds": []}
    rows = await get_pool().fetch("SELECT event_id FROM event_rsvps WHERE user_id = $1", user_id)
    return {"eventIds": [r["event_id"] for r in rows]}


@router.get("/my-reminders")
async def my_reminders(user_id: Optional[int] = Depends(get_optional_user_id)):
    if user_id is None:
        return {"eventIds": []}
    rows = await get_pool().fetch("SELECT event_id FROM event_reminders WHERE user_id = $1", user_id)
    return {"eventIds": [r["event_id"] for r in rows]}


@router.get("/{event_id}/rsvp")
async def get_rsvp(
    event_id: int,
    all: Optional[str] = Query(None),
    user_id: Optional[int] = Depends(get_optional_user_id),
    staff_role: Optional[str] = Depends(get_staff_role),
):
    pool = get_pool()
    if all == "true":
        if staff_role is None:
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
        rows = await pool.fetch(
            """SELECT u.id, u.full_name, u.email, r.created_at
               FROM event_rsvps r JOIN users u ON u.id = r.user_id
               WHERE r.event_id = $1 ORDER BY r.created_at ASC""",
            event_id,
        )
        return {"attendees": [dict(r) for r in rows]}

    if user_id is None:
        return {"rsvped": False}
    row = await pool.fetchrow("SELECT 1 FROM event_rsvps WHERE event_id = $1 AND user_id = $2", event_id, user_id)
    return {"rsvped": row is not None}


@router.post("/{event_id}/rsvp")
async def create_rsvp(event_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    event = await pool.fetchrow("SELECT id, title, status FROM events WHERE id = $1", event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    if event["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="RSVPs are only open for upcoming events.")

    inserted = await pool.fetchrow(
        "INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2) ON CONFLICT (event_id, user_id) DO NOTHING RETURNING id",
        event_id, user_id,
    )

    if inserted:
        try:
            await create_notification(user_id, "event", "RSVP Confirmed", f'You\'re confirmed for "{event["title"]}".', "/portal/events")
        except Exception:
            pass

    count = await pool.fetchval("SELECT count(*)::int FROM event_rsvps WHERE event_id = $1", event_id)
    return {"rsvped": True, "attendees": count}


@router.delete("/{event_id}/rsvp")
async def cancel_rsvp(event_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    await pool.execute("DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2", event_id, user_id)
    count = await pool.fetchval("SELECT count(*)::int FROM event_rsvps WHERE event_id = $1", event_id)
    return {"rsvped": False, "attendees": count}


@router.post("/{event_id}/reminder")
async def save_reminder(event_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    event = await pool.fetchrow("SELECT id, title FROM events WHERE id = $1", event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    inserted = await pool.fetchrow(
        "INSERT INTO event_reminders (event_id, user_id) VALUES ($1, $2) ON CONFLICT (event_id, user_id) DO NOTHING RETURNING id",
        event_id, user_id,
    )
    if inserted:
        try:
            await create_notification(user_id, "event", "Event Saved", f'"{event["title"]}" has been added to your saved events.', "/portal/events")
        except Exception:
            pass
    return {"saved": True}


@router.delete("/{event_id}/reminder")
async def remove_reminder(event_id: int, user_id: int = Depends(require_alumni_user_id)):
    await get_pool().execute("DELETE FROM event_reminders WHERE event_id = $1 AND user_id = $2", event_id, user_id)
    return {"saved": False}
