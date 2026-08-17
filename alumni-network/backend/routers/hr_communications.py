from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from starlette.datastructures import UploadFile as StarletteUploadFile

from core import storage
from core.db import get_hr_communications_user_id, get_pool
from core.deps import require_role
from core.notifications import create_notification
from core.ws_manager import manager

router = APIRouter(prefix="/api/hr/hr-communications")

staff_only = Depends(require_role("hr", "admin"))

MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024


@router.get("", dependencies=[staff_only])
async def list_conversations():
    pool = get_pool()
    hr_comm_id = await get_hr_communications_user_id()

    rows = await pool.fetch(
        """SELECT u.id, u.full_name, u.profile_photo_path,
                  m.body AS last_body, m.attachment_filename AS last_attachment_filename,
                  m.created_at AS last_message_at,
                  COALESCE(unread.count, 0)::int AS unread
           FROM users u
           JOIN LATERAL (
             SELECT body, attachment_filename, created_at FROM messages
             WHERE deleted_at IS NULL AND ((sender_id = u.id AND recipient_id = $1) OR (sender_id = $1 AND recipient_id = u.id))
             ORDER BY created_at DESC LIMIT 1
           ) m ON true
           LEFT JOIN LATERAL (
             SELECT count(*)::int AS count FROM messages
             WHERE sender_id = u.id AND recipient_id = $1 AND read = false AND deleted_at IS NULL
           ) unread ON true
           WHERE u.status != 'system'
           ORDER BY m.created_at DESC""",
        hr_comm_id,
    )

    conversations = [
        {
            "alumniId": r["id"],
            "fullName": r["full_name"],
            "profilePhotoPath": r["profile_photo_path"],
            "lastMessage": r["last_body"] or (f"📎 {r['last_attachment_filename']}" if r["last_attachment_filename"] else None),
            "lastMessageAt": r["last_message_at"],
            "unread": r["unread"],
        }
        for r in rows
    ]
    return {"conversations": conversations}


@router.get("/{alumni_id}", dependencies=[staff_only])
async def get_thread(alumni_id: int):
    pool = get_pool()
    hr_comm_id = await get_hr_communications_user_id()

    alumnus = await pool.fetchrow("SELECT id, full_name FROM users WHERE id = $1 AND status != 'system'", alumni_id)
    if alumnus is None:
        raise HTTPException(status_code=404, detail="Alumnus not found.")

    rows = await pool.fetch(
        """SELECT * FROM messages
           WHERE ((sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)) AND deleted_at IS NULL
           ORDER BY created_at ASC""",
        alumni_id, hr_comm_id,
    )
    await pool.execute(
        "UPDATE messages SET read = true WHERE sender_id = $1 AND recipient_id = $2 AND read = false",
        alumni_id, hr_comm_id,
    )
    return {"alumniName": alumnus["full_name"], "messages": [dict(r) for r in rows]}


@router.post("/{alumni_id}", status_code=201, dependencies=[staff_only])
async def send_message(alumni_id: int, request: Request, staff: dict = Depends(require_role("hr", "admin"))):
    pool = get_pool()
    hr_comm_id = await get_hr_communications_user_id()

    alumnus = await pool.fetchrow("SELECT id FROM users WHERE id = $1 AND status != 'system'", alumni_id)
    if alumnus is None:
        raise HTTPException(status_code=404, detail="Alumnus not found.")

    form = await request.form()
    text = str(form.get("body") or "").strip() or None
    raw_file = form.get("file")
    file = raw_file if isinstance(raw_file, StarletteUploadFile) and raw_file.filename else None

    if not text and not file:
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
        attachment_storage_key = storage.save_file(data, "message_attachments", ext)
        attachment_filename = file.filename
        attachment_size = len(data)

    row = await pool.fetchrow(
        """INSERT INTO messages (sender_id, recipient_id, body, attachment_filename, attachment_storage_key, attachment_size_bytes, sent_by_staff_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *""",
        hr_comm_id, alumni_id, text, attachment_filename, attachment_storage_key, attachment_size, staff["id"],
    )
    message_dict = dict(row)
    message_dict["reactions"] = []
    message_dict["reply_to"] = None

    await manager.send_to_user(alumni_id, {"type": "message", "message": message_dict})

    try:
        await create_notification(
            alumni_id, "message", "New Message", "HR Communications sent you a message.", "/portal/messages"
        )
    except Exception:
        pass

    return {"message": message_dict}


@router.get("/{alumni_id}/attachments/{message_id}", dependencies=[staff_only])
async def download_attachment(alumni_id: int, message_id: int):
    hr_comm_id = await get_hr_communications_user_id()
    row = await get_pool().fetchrow(
        "SELECT sender_id, recipient_id, attachment_storage_key, attachment_filename, deleted_at FROM messages WHERE id = $1",
        message_id,
    )
    if row is None or row["attachment_storage_key"] is None or row["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    if {row["sender_id"], row["recipient_id"]} != {alumni_id, hr_comm_id}:
        raise HTTPException(status_code=403, detail="You don't have access to this attachment.")
    data = storage.read_file(row["attachment_storage_key"])
    return Response(
        content=data, media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row["attachment_filename"]}"'},
    )
