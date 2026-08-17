from typing import Optional

from sqlalchemy.orm import Session

from app.models.base import UserActivityLog


def log_activity(db: Session, employee_id: int, actor_id: Optional[int], action: str, detail: Optional[str] = None) -> None:
    """Shared by auth.py (login events) and user_management.py (role/manager/
    access changes) so both write to the same audit table the same way.
    Does not commit — rides the caller's existing transaction.
    """
    db.add(UserActivityLog(employee_id=employee_id, actor_id=actor_id, action=action, detail=detail))
