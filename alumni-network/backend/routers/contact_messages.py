import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from core.db import get_pool
from core.deps import require_role
from core.notifications import create_staff_notification
from core.sql_utils import affected_count

router = APIRouter(prefix="/api/contact-messages")

admin_only = Depends(require_role("admin"))


@router.get("", dependencies=[admin_only])
async def list_contact_messages(status: Optional[str] = None):
    conditions = []
    params: list = []
    if status:
        params.append(status)
        conditions.append(f"status = ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = await get_pool().fetch(f"SELECT * FROM contact_messages {where} ORDER BY created_at DESC, id DESC", *params)
    return {"messages": [dict(r) for r in rows]}


@router.post("", status_code=201)
async def create_contact_message(request: Request):
    body = await request.json()
    first_name = str(body.get("firstName") or "").strip()
    last_name = str(body.get("lastName") or "").strip()
    email = str(body.get("email") or "").strip()
    message = str(body.get("message") or "").strip()

    if not first_name or not last_name or not email or not message:
        raise HTTPException(status_code=400, detail="All fields are required.")
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    row = await get_pool().fetchrow(
        "INSERT INTO contact_messages (first_name, last_name, email, message, status) VALUES ($1,$2,$3,$4,'unread') RETURNING *",
        first_name, last_name, email, message,
    )

    try:
        await create_staff_notification(
            "admin", "contact_message", "New Contact Message",
            f"{first_name} {last_name} sent a message via Contact Us.", "/admin/inquiries",
        )
    except Exception:
        pass

    return {"message": dict(row)}


@router.patch("/{message_id}", dependencies=[admin_only])
async def update_contact_message(message_id: int, request: Request):
    body = await request.json()
    if not body.get("status"):
        raise HTTPException(status_code=400, detail="No fields to update.")

    row = await get_pool().fetchrow(
        "UPDATE contact_messages SET status = $1, updated_at = now() WHERE id = $2 RETURNING *", body["status"], message_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    return {"message": dict(row)}


@router.delete("/{message_id}", dependencies=[admin_only])
async def delete_contact_message(message_id: int):
    result = await get_pool().execute("DELETE FROM contact_messages WHERE id = $1", message_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Message not found.")
    return {"success": True}
