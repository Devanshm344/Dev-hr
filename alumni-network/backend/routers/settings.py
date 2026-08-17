from fastapi import APIRouter, Depends, Request

from core.db import get_pool
from core.deps import require_alumni_user_id, require_staff_role

router = APIRouter(prefix="/api/settings")

STAFF_PREF_DEFAULTS = {"registrationAlert": True, "benefitRequestAlert": True}

NOTIF_KEYS = ["email", "messages", "events", "requests", "benefits", "forum", "announcements"]
NOTIF_DEFAULTS = {"email": True, "messages": True, "events": True, "requests": True, "benefits": False, "forum": False, "announcements": True}

PRIVACY_KEYS = ["show_in_directory", "allow_connection_requests", "show_online_status", "share_activity"]
PRIVACY_DEFAULTS = {"show_in_directory": True, "allow_connection_requests": True, "show_online_status": False, "share_activity": True}


@router.get("/notification-prefs")
async def get_notification_prefs(user_id: int = Depends(require_alumni_user_id)):
    row = await get_pool().fetchrow("SELECT * FROM notification_prefs WHERE user_id = $1", user_id)
    if row:
        return {"prefs": {k: row[k] for k in NOTIF_KEYS}}
    return {"prefs": NOTIF_DEFAULTS}


@router.put("/notification-prefs")
async def put_notification_prefs(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    values = [body.get(k) is True for k in NOTIF_KEYS]
    row = await get_pool().fetchrow(
        """INSERT INTO notification_prefs (user_id, email, messages, events, requests, benefits, forum, announcements)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id) DO UPDATE SET
             email = $2, messages = $3, events = $4, requests = $5, benefits = $6, forum = $7, announcements = $8, updated_at = now()
           RETURNING *""",
        user_id, *values,
    )
    return {"prefs": {k: row[k] for k in NOTIF_KEYS}}


@router.get("/privacy")
async def get_privacy(user_id: int = Depends(require_alumni_user_id)):
    row = await get_pool().fetchrow("SELECT * FROM privacy_settings WHERE user_id = $1", user_id)
    if row:
        return {"privacy": {k: row[k] for k in PRIVACY_KEYS}}
    return {"privacy": PRIVACY_DEFAULTS}


@router.put("/privacy")
async def put_privacy(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    values = [body.get(k) is True for k in PRIVACY_KEYS]
    row = await get_pool().fetchrow(
        """INSERT INTO privacy_settings (user_id, show_in_directory, allow_connection_requests, show_online_status, share_activity)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id) DO UPDATE SET
             show_in_directory = $2, allow_connection_requests = $3, show_online_status = $4, share_activity = $5, updated_at = now()
           RETURNING *""",
        user_id, *values,
    )
    return {"privacy": {k: row[k] for k in PRIVACY_KEYS}}


@router.get("/staff-notification-prefs")
async def get_staff_notification_prefs(role: str = Depends(require_staff_role)):
    row = await get_pool().fetchrow(
        "SELECT registration_alert, benefit_request_alert FROM staff_notification_prefs WHERE role = $1", role
    )
    if row:
        return {"prefs": {"registrationAlert": row["registration_alert"], "benefitRequestAlert": row["benefit_request_alert"]}}
    return {"prefs": STAFF_PREF_DEFAULTS}


@router.put("/staff-notification-prefs")
async def put_staff_notification_prefs(request: Request, role: str = Depends(require_staff_role)):
    body = await request.json()
    registration_alert = body.get("registrationAlert") is not False
    benefit_request_alert = body.get("benefitRequestAlert") is not False

    await get_pool().execute(
        """INSERT INTO staff_notification_prefs (role, registration_alert, benefit_request_alert, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (role) DO UPDATE SET registration_alert = $2, benefit_request_alert = $3, updated_at = now()""",
        role, registration_alert, benefit_request_alert,
    )
    return {"prefs": {"registrationAlert": registration_alert, "benefitRequestAlert": benefit_request_alert}}
