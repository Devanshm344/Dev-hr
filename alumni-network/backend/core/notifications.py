from typing import Literal, Optional

from core.db import get_pool


async def create_notification(user_id: int, type: str, title: str, message: str, link: Optional[str] = None) -> None:
    await get_pool().execute(
        "INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5)",
        user_id, type, title, message, link,
    )


async def create_staff_notification(role: Literal["hr", "admin"], type: str, title: str, message: str, link: Optional[str] = None) -> None:
    await get_pool().execute(
        "INSERT INTO staff_notifications (role, type, title, message, link) VALUES ($1, $2, $3, $4, $5)",
        role, type, title, message, link,
    )


async def staff_wants_alert(role: Literal["hr", "admin"], kind: Literal["registration", "benefitRequest"]) -> bool:
    column = "registration_alert" if kind == "registration" else "benefit_request_alert"
    value = await get_pool().fetchval(f"SELECT {column} FROM staff_notification_prefs WHERE role = $1", role)
    return True if value is None else bool(value)
