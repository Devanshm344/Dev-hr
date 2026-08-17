from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.db import get_pool
from core.deps import require_alumni_user_id
from core.sql_utils import affected_count

router = APIRouter(prefix="/api/notifications")


@router.get("")
async def list_notifications(limit: int = Query(50), user_id: int = Depends(require_alumni_user_id)):
    limit = min(100, max(1, limit))
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT id, type, title, message, link, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        user_id, limit,
    )
    unread_count = await pool.fetchval("SELECT count(*)::int FROM notifications WHERE user_id = $1 AND read = false", user_id)
    return {"notifications": [dict(r) for r in rows], "unreadCount": unread_count}


@router.post("")
async def mark_all_read(user_id: int = Depends(require_alumni_user_id)):
    await get_pool().execute("UPDATE notifications SET read = true WHERE user_id = $1 AND read = false", user_id)
    return {"success": True}


@router.patch("/{notification_id}")
async def mark_one_read(notification_id: int, user_id: int = Depends(require_alumni_user_id)):
    result = await get_pool().execute(
        "UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2", notification_id, user_id
    )
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"success": True}
