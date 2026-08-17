from fastapi import APIRouter, Depends, HTTPException, Query

from core.db import get_pool
from core.deps import require_staff_role
from core.sql_utils import affected_count

router = APIRouter(prefix="/api/staff-notifications")


@router.get("")
async def list_staff_notifications(limit: int = Query(50), role: str = Depends(require_staff_role)):
    limit = min(100, max(1, limit))
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT id, type, title, message, link, read, created_at FROM staff_notifications WHERE role = $1 ORDER BY created_at DESC LIMIT $2",
        role, limit,
    )
    unread_count = await pool.fetchval("SELECT count(*)::int FROM staff_notifications WHERE role = $1 AND read = false", role)
    return {"notifications": [dict(r) for r in rows], "unreadCount": unread_count}


@router.post("")
async def mark_all_read(role: str = Depends(require_staff_role)):
    await get_pool().execute("UPDATE staff_notifications SET read = true WHERE role = $1 AND read = false", role)
    return {"success": True}


@router.patch("/{notification_id}")
async def mark_one_read(notification_id: int, role: str = Depends(require_staff_role)):
    result = await get_pool().execute(
        "UPDATE staff_notifications SET read = true WHERE id = $1 AND role = $2", notification_id, role
    )
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"success": True}
