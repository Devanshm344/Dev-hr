from fastapi import APIRouter, Depends

from app.engagement.db import get_db
from app.engagement.deps import get_current_user
from app.engagement.exceptions import NotFoundError
from app.engagement.repositories import notifications_repo

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_mine(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    return {"data": notifications_repo.list_for_user(conn, user["id"])}


@router.get("/unread-count")
def unread_count(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    return {"data": {"count": notifications_repo.unread_count(conn, user["id"])}}


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    updated = notifications_repo.mark_read(conn, user["id"], notification_id)
    if updated is None:
        raise NotFoundError("Notification not found")
    return {"data": updated, "message": "Marked as read"}


@router.post("/read-all")
def mark_all_read(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    marked = notifications_repo.mark_all_read(conn, user["id"])
    return {"data": {"marked": marked}, "message": "All notifications marked as read"}
