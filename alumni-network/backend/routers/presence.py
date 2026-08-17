from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.auth import SessionPayload
from core.db import get_pool
from core.deps import get_session

router = APIRouter(prefix="/api/presence")


@router.post("/heartbeat")
async def heartbeat(session: Optional[SessionPayload] = Depends(get_session)):
    if not session or session["role"] != "alumni":
        raise HTTPException(status_code=401, detail="Not authenticated.")
    await get_pool().execute("UPDATE users SET last_active_at = now() WHERE id = $1", session["userId"])
    return {"ok": True}
