import asyncio
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional, TypedDict

import bcrypt
import jwt

from core.config import settings

SESSION_COOKIE = "td_session"

Role = Literal["alumni", "hr", "admin"]


class SessionPayload(TypedDict):
    userId: int
    email: str
    role: Role


def _hash_password_sync(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")


def _verify_password_sync(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


async def hash_password(password: str) -> str:
    # bcrypt is CPU-bound and synchronous; run off the event loop so one
    # slow hash doesn't stall every other in-flight request.
    return await asyncio.to_thread(_hash_password_sync, password)


async def verify_password(password: str, hashed: str) -> bool:
    return await asyncio.to_thread(_verify_password_sync, password, hashed)


def create_session_token(payload: SessionPayload, expires_in_seconds: int = 60 * 60 * 24 * 7) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        **payload,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in_seconds),
    }
    return jwt.encode(claims, settings.auth_secret, algorithm="HS256")


def verify_session_token(token: str) -> Optional[SessionPayload]:
    try:
        payload = jwt.decode(token, settings.auth_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if not isinstance(payload.get("userId"), int) or not isinstance(payload.get("email"), str):
        return None
    if payload.get("role") not in ("alumni", "hr", "admin"):
        return None
    return {"userId": payload["userId"], "email": payload["email"], "role": payload["role"]}
