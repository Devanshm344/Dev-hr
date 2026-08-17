from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from starlette.datastructures import UploadFile as StarletteUploadFile

from core import storage
from core.ai import AIError, generate_reply
from core.db import get_pool
from core.deps import get_optional_user_id, get_session, get_staff_role, require_alumni_user_id, require_role
from core.notifications import create_notification, create_staff_notification, staff_wants_alert

router = APIRouter(prefix="/api/service-requests")

hr_only = Depends(require_role("hr", "admin"))

MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024

STATUS_MESSAGES = {
    "under-review": lambda b, n: ("Request Under Review", f'Your request for "{b}" is now under review by HR.'),
    "approved": lambda b, n: ("Request Approved", f'Your request for "{b}" has been approved.' + (f" HR note: {n}" if n else "")),
    "rejected": lambda b, n: ("Request Not Approved", f'Your request for "{b}" was not approved.' + (f" HR note: {n}" if n else "")),
    "completed": lambda b, n: ("Request Completed", f'Your request for "{b}" has been marked completed.'),
}


@router.get("")
async def list_requests(
    all: Optional[str] = Query(None),
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1),
    pageSize: int = Query(20),
    user_id: Optional[int] = Depends(get_optional_user_id),
    staff_role: Optional[str] = Depends(get_staff_role),
):
    pool = get_pool()
    if all != "true":
        if user_id is None:
            raise HTTPException(status_code=401, detail="Not authenticated.")
        rows = await pool.fetch("SELECT * FROM service_requests WHERE user_id = $1 ORDER BY created_at DESC", user_id)
        return {"requests": [dict(r) for r in rows]}

    if staff_role is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    page = max(1, page)
    page_size = min(100, max(1, pageSize))
    conditions = []
    params: list = []
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"(sr.benefit_title ILIKE ${len(params)} OR u.full_name ILIKE ${len(params)})")
    if status and status != "all":
        params.append(status)
        conditions.append(f"sr.status = ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    total = await pool.fetchval(f"SELECT count(*)::int FROM service_requests sr JOIN users u ON u.id = sr.user_id {where}", *params)

    params2 = [*params, page_size, (page - 1) * page_size]
    rows = await pool.fetch(
        f"""SELECT sr.*, u.full_name AS alumni_name, u.email AS alumni_email
            FROM service_requests sr JOIN users u ON u.id = sr.user_id
            {where} ORDER BY sr.created_at DESC LIMIT ${len(params2) - 1} OFFSET ${len(params2)}""",
        *params2,
    )
    return {"requests": [dict(r) for r in rows], "total": total, "page": page, "pageSize": page_size}


@router.post("", status_code=201)
async def create_request(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    try:
        benefit_id = int(body.get("benefitId"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A benefit must be selected.")
    notes = str(body.get("notes") or "").strip()
    priority = str(body.get("priority") or "medium").strip()

    pool = get_pool()
    benefit = await pool.fetchrow("SELECT id, title, active FROM benefits WHERE id = $1", benefit_id)
    if not benefit or not benefit["active"]:
        raise HTTPException(status_code=400, detail="This benefit is no longer available. Please refresh and choose another.")

    row = await pool.fetchrow(
        """INSERT INTO service_requests (user_id, benefit_id, benefit_title, notes, priority, status)
           VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *""",
        user_id, benefit["id"], benefit["title"], notes or None, priority,
    )

    if await staff_wants_alert("hr", "benefitRequest"):
        requester = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
        try:
            await create_staff_notification(
                "hr", "service_request", "New Service Request",
                f"{(requester['full_name'] if requester else 'An alumnus')} requested {benefit['title']}.", "/hr/requests",
            )
        except Exception:
            pass

    return {"request": dict(row)}


@router.patch("/{request_id}", dependencies=[hr_only])
async def update_request(request_id: int, request: Request):
    body = await request.json()
    pool = get_pool()

    prior_status = None
    if "status" in body:
        prior = await pool.fetchrow("SELECT status FROM service_requests WHERE id = $1", request_id)
        prior_status = prior["status"] if prior else None

    set_clauses = []
    values: list = []
    if "status" in body:
        values.append(body["status"])
        set_clauses.append(f"status = ${len(values)}")
    if "hrNotes" in body:
        values.append(body["hrNotes"])
        set_clauses.append(f"hr_notes = ${len(values)}")

    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")

    values.append(request_id)
    updated = await pool.fetchrow(
        f"UPDATE service_requests SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Request not found.")

    new_status = body.get("status")
    if new_status and new_status != prior_status and new_status in STATUS_MESSAGES:
        title, message = STATUS_MESSAGES[new_status](updated["benefit_title"], body.get("hrNotes"))
        try:
            await create_notification(updated["user_id"], "request", title, message, "/portal/requests")
        except Exception:
            pass

    return {"request": dict(updated)}


@router.delete("/{request_id}", dependencies=[hr_only])
async def delete_request(request_id: int):
    pool = get_pool()
    attachments = await pool.fetch(
        "SELECT attachment_storage_key FROM service_request_messages WHERE request_id = $1 AND attachment_storage_key IS NOT NULL",
        request_id,
    )
    deleted_id = await pool.fetchval("DELETE FROM service_requests WHERE id = $1 RETURNING id", request_id)
    if deleted_id is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    for row in attachments:
        storage.delete_file(row["attachment_storage_key"])
    return {"success": True}


async def _authorize_request_access(request_id: int, session):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    row = await get_pool().fetchrow("SELECT id, user_id FROM service_requests WHERE id = $1", request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    if session["role"] == "alumni":
        if session["userId"] != row["user_id"]:
            raise HTTPException(status_code=403, detail="You do not have access to this request.")
        return "alumni", session["userId"]
    if session["role"] in ("hr", "admin"):
        return "staff", session["userId"]
    raise HTTPException(status_code=401, detail="Not authenticated.")


@router.get("/{request_id}")
async def get_request(request_id: int, session=Depends(get_session)):
    await _authorize_request_access(request_id, session)
    row = await get_pool().fetchrow(
        """SELECT sr.*, u.full_name AS alumni_name, u.email AS alumni_email
           FROM service_requests sr JOIN users u ON u.id = sr.user_id WHERE sr.id = $1""",
        request_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    return {"request": dict(row)}


@router.get("/{request_id}/messages")
async def list_messages(request_id: int, session=Depends(get_session)):
    await _authorize_request_access(request_id, session)
    rows = await get_pool().fetch(
        """SELECT id, request_id, sender_type, sender_id, body, attachment_filename, attachment_size_bytes, created_at
           FROM service_request_messages WHERE request_id = $1 ORDER BY created_at ASC""",
        request_id,
    )
    return {"messages": [dict(r) for r in rows]}


@router.post("/{request_id}/messages/summarize")
async def summarize_thread(request_id: int, session=Depends(get_session)):
    await _authorize_request_access(request_id, session)
    pool = get_pool()

    req = await pool.fetchrow(
        """SELECT sr.benefit_title, u.full_name AS alumni_name
           FROM service_requests sr JOIN users u ON u.id = sr.user_id WHERE sr.id = $1""",
        request_id,
    )
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found.")

    rows = await pool.fetch(
        "SELECT sender_type, body, attachment_filename FROM service_request_messages WHERE request_id = $1 ORDER BY created_at ASC",
        request_id,
    )
    if not rows:
        raise HTTPException(status_code=400, detail="There's no conversation yet to summarize.")

    transcript_lines = []
    for r in rows:
        speaker = "Alumnus" if r["sender_type"] == "alumni" else "HR"
        piece = r["body"] or ""
        if r["attachment_filename"]:
            piece = f"{piece} [attached file: {r['attachment_filename']}]".strip()
        transcript_lines.append(f"{speaker}: {piece}")

    system_prompt = (
        "You summarize HR/alumni conversation threads for the TechDemocracy Alumni Network staff portal. "
        f"This thread is about a service request for \"{req['benefit_title']}\" involving alumnus {req['alumni_name']}. "
        "Summarize the conversation in 2-4 concise sentences: key points, any decisions made, and anything still "
        "open/unresolved. Reply in plain text only, no markdown."
    )
    try:
        summary = await generate_reply(system_prompt, [{"role": "user", "text": "\n".join(transcript_lines)}])
    except AIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"summary": summary}


@router.post("/{request_id}/messages", status_code=201)
async def send_message(request_id: int, request: Request, session=Depends(get_session)):
    sender_type, sender_id = await _authorize_request_access(request_id, session)
    pool = get_pool()

    form = await request.form()
    body_text = str(form.get("body") or "").strip() or None
    raw_file = form.get("file")
    file = raw_file if isinstance(raw_file, StarletteUploadFile) and raw_file.filename else None

    if not body_text and not file:
        raise HTTPException(status_code=400, detail="Message must have text or a file attached.")

    attachment_filename = attachment_storage_key = None
    attachment_size = None
    if file:
        data = await file.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f'"{file.filename}" is empty.')
        if len(data) > MAX_ATTACHMENT_SIZE_BYTES:
            raise HTTPException(status_code=400, detail=f'"{file.filename}" exceeds the 20MB limit.')
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
        attachment_storage_key = storage.save_file(data, "service_request_attachments", ext)
        attachment_filename = file.filename
        attachment_size = len(data)

    row = await pool.fetchrow(
        """INSERT INTO service_request_messages
           (request_id, sender_type, sender_id, body, attachment_filename, attachment_storage_key, attachment_size_bytes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, request_id, sender_type, sender_id, body, attachment_filename, attachment_size_bytes, created_at""",
        request_id, sender_type, sender_id, body_text, attachment_filename, attachment_storage_key, attachment_size,
    )

    req = await pool.fetchrow("SELECT user_id, benefit_title FROM service_requests WHERE id = $1", request_id)
    try:
        if sender_type == "alumni":
            if await staff_wants_alert("hr", "benefitRequest"):
                sender = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", sender_id)
                await create_staff_notification(
                    "hr", "service_request_message", "New Message on Service Request",
                    f'{(sender["full_name"] if sender else "An alumnus")} sent a message on "{req["benefit_title"]}".',
                    "/hr/requests",
                )
        else:
            await create_notification(
                req["user_id"], "request", "New Message from HR",
                f'HR sent you a message on your "{req["benefit_title"]}" request.', "/portal/requests",
            )
    except Exception:
        pass

    return {"message": dict(row)}


@router.get("/{request_id}/messages/{message_id}/attachment")
async def download_attachment(request_id: int, message_id: int, session=Depends(get_session)):
    await _authorize_request_access(request_id, session)
    row = await get_pool().fetchrow(
        "SELECT attachment_storage_key, attachment_filename FROM service_request_messages WHERE id = $1 AND request_id = $2",
        message_id, request_id,
    )
    if row is None or row["attachment_storage_key"] is None:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    data = storage.read_file(row["attachment_storage_key"])
    return Response(
        content=data, media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row["attachment_filename"]}"'},
    )
