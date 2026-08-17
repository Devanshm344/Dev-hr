from typing import Optional

from fastapi import Depends, HTTPException, Request

from core.auth import SESSION_COOKIE, SessionPayload, verify_session_token
from core.db import get_pool


def get_session(request: Request) -> Optional[SessionPayload]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    return verify_session_token(token)


async def get_current_alumni(session: Optional[SessionPayload] = Depends(get_session)) -> dict:
    if not session or session["role"] != "alumni":
        raise HTTPException(status_code=401, detail="Not authenticated.")
    row = await get_pool().fetchrow("SELECT * FROM users WHERE id = $1 AND status = 'active'", session["userId"])
    if row is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return dict(row)


async def get_current_alumni_optional(session: Optional[SessionPayload] = Depends(get_session)) -> Optional[dict]:
    if not session or session["role"] != "alumni":
        return None
    row = await get_pool().fetchrow("SELECT * FROM users WHERE id = $1 AND status = 'active'", session["userId"])
    return dict(row) if row else None


async def get_current_staff(session: Optional[SessionPayload] = Depends(get_session)) -> dict:
    if not session or session["role"] not in ("hr", "admin"):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    row = await get_pool().fetchrow(
        "SELECT id, full_name, email, role FROM staff_users WHERE id = $1 AND role = $2 AND active = true",
        session["userId"], session["role"],
    )
    if row is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return dict(row)


async def get_optional_user_id(session: Optional[SessionPayload] = Depends(get_session)) -> Optional[int]:
    if not session or session["role"] != "alumni":
        return None
    status = await get_pool().fetchval("SELECT status FROM users WHERE id = $1", session["userId"])
    if status != "active":
        return None
    return session["userId"]


async def require_alumni_user_id(user_id: Optional[int] = Depends(get_optional_user_id)) -> int:
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user_id


async def get_staff_role(session: Optional[SessionPayload] = Depends(get_session)) -> Optional[str]:
    if not session or session["role"] not in ("hr", "admin"):
        return None
    row = await get_pool().fetchrow(
        "SELECT active FROM staff_users WHERE id = $1 AND role = $2",
        session["userId"], session["role"],
    )
    if row is None or not row["active"]:
        return None
    return session["role"]


async def require_staff_role(role: Optional[str] = Depends(get_staff_role)) -> str:
    if role is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return role


def require_role(*roles: str):
    async def _dep(staff: dict = Depends(get_current_staff)) -> dict:
        if staff["role"] not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
        return staff
    return _dep
