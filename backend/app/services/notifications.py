from typing import Optional

from sqlalchemy.orm import Session

from app.models.base import Notification


def create_notification(
    db: Session, *, user_id: int, type: str, title: str,
    body: Optional[str] = None, link: Optional[str] = None,
) -> None:
    """Shared by leave.py and announcements.py so core HRMS events land in the
    same bell dropdown the Associate Engagement module already writes to
    (same `notifications` table, keyed by employees.id).
    Does not commit — rides the caller's existing transaction.
    """
    db.add(Notification(user_id=user_id, type=type, title=title, body=body, link=link))
