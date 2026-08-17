from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from starlette.datastructures import UploadFile as StarletteUploadFile

from core import storage
from core.auth import SESSION_COOKIE, verify_session_token
from core.db import get_hr_communications_user_id, get_pool
from core.deps import require_alumni_user_id
from core.notifications import create_notification, create_staff_notification
from core.ws_manager import manager

router = APIRouter(prefix="/api/messages")

MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024


async def _are_connected(user_id: int, other_id: int) -> bool:
    row = await get_pool().fetchrow(
        """SELECT 1 FROM connections WHERE status = 'accepted' AND
           ((requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1))""",
        user_id, other_id,
    )
    return row is not None


def _redact_if_deleted(msg: dict) -> dict:
    if msg.get("deleted_at"):
        msg["body"] = None
        msg["attachment_filename"] = None
        msg["attachment_storage_key"] = None
        msg["attachment_size_bytes"] = None
    return msg


async def _is_blocked(user_id: int, other_id: int) -> bool:
    row = await get_pool().fetchrow(
        """SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)""",
        user_id, other_id,
    )
    return row is not None


async def _attach_reply_to(messages: list[dict]) -> list[dict]:
    reply_ids = [m["reply_to_id"] for m in messages if m.get("reply_to_id")]
    if not reply_ids:
        for m in messages:
            m["reply_to"] = None
        return messages
    rows = await get_pool().fetch(
        "SELECT id, sender_id, body, attachment_filename, deleted_at FROM messages WHERE id = ANY($1::int[])", reply_ids
    )
    by_id = {r["id"]: r for r in rows}
    for m in messages:
        r = by_id.get(m.get("reply_to_id"))
        if r is None:
            m["reply_to"] = None
        elif r["deleted_at"] is not None:
            m["reply_to"] = {"id": r["id"], "senderId": r["sender_id"], "body": None, "attachmentFilename": None, "deleted": True}
        else:
            m["reply_to"] = {
                "id": r["id"], "senderId": r["sender_id"], "body": r["body"],
                "attachmentFilename": r["attachment_filename"], "deleted": False,
            }
    return messages


async def _attach_reactions(messages: list[dict], viewer_id: int) -> list[dict]:
    if not messages:
        return messages
    ids = [m["id"] for m in messages]
    rows = await get_pool().fetch(
        "SELECT message_id, emoji, user_id FROM message_reactions WHERE message_id = ANY($1::int[])", ids
    )
    by_message: dict[int, dict[str, dict]] = {}
    for r in rows:
        by_emoji = by_message.setdefault(r["message_id"], {})
        entry = by_emoji.setdefault(r["emoji"], {"emoji": r["emoji"], "count": 0, "reactedByMe": False})
        entry["count"] += 1
        if r["user_id"] == viewer_id:
            entry["reactedByMe"] = True
    for m in messages:
        m["reactions"] = list(by_message.get(m["id"], {}).values())
    return messages


@router.websocket("/ws")
async def messages_ws(websocket: WebSocket):
    token = websocket.cookies.get(SESSION_COOKIE)
    session = verify_session_token(token) if token else None
    if not session or session["role"] != "alumni":
        await websocket.close(code=1008)
        return

    user_id = session["userId"]
    status = await get_pool().fetchval("SELECT status FROM users WHERE id = $1", user_id)
    if status != "active":
        await websocket.close(code=1008)
        return

    await websocket.accept()
    manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_json()
            if raw.get("type") == "typing":
                with_user_id = raw.get("withUserId")
                if isinstance(with_user_id, int) and await _are_connected(user_id, with_user_id):
                    await manager.send_to_user(with_user_id, {"type": "typing", "fromUserId": user_id})
            elif raw.get("type") == "group_typing":
                group_id = raw.get("groupId")
                if isinstance(group_id, int):
                    member_rows = await get_pool().fetch(
                        "SELECT user_id FROM group_members WHERE group_id = $1", group_id
                    )
                    member_ids = {r["user_id"] for r in member_rows}
                    if user_id in member_ids:
                        for other_id in member_ids - {user_id}:
                            await manager.send_to_user(other_id, {"type": "group_typing", "groupId": group_id, "fromUserId": user_id})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(user_id, websocket)


@router.get("")
async def get_thread(withUserId: int = Query(...), user_id: int = Depends(require_alumni_user_id)):
    if not await _are_connected(user_id, withUserId):
        raise HTTPException(status_code=403, detail="You can only message accepted connections.")

    pool = get_pool()
    rows = await pool.fetch(
        """SELECT * FROM messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
           ORDER BY created_at ASC""",
        user_id, withUserId,
    )
    marked = await pool.fetch(
        "UPDATE messages SET read = true WHERE sender_id = $1 AND recipient_id = $2 AND read = false RETURNING id",
        withUserId, user_id,
    )
    if marked:
        await manager.send_to_user(withUserId, {"type": "seen", "byUserId": user_id, "withUserId": withUserId})
    messages = [_redact_if_deleted(dict(r)) for r in rows]
    messages = await _attach_reply_to(messages)
    messages = await _attach_reactions(messages, user_id)
    return {"messages": messages}


@router.post("", status_code=201)
async def send_message(request: Request, user_id: int = Depends(require_alumni_user_id)):
    form = await request.form()
    try:
        recipient_id = int(form.get("recipientId"))
    except (TypeError, ValueError):
        recipient_id = -1
    text = str(form.get("body") or "").strip() or None
    raw_file = form.get("file")
    file = raw_file if isinstance(raw_file, StarletteUploadFile) and raw_file.filename else None
    try:
        reply_to_id = int(form.get("replyToMessageId"))
    except (TypeError, ValueError):
        reply_to_id = None

    if recipient_id < 1:
        raise HTTPException(status_code=400, detail="A recipient is required.")
    if not text and not file:
        raise HTTPException(status_code=400, detail="Message must have text or a file attached.")

    if not await _are_connected(user_id, recipient_id):
        raise HTTPException(status_code=403, detail="You can only message accepted connections.")
    if await _is_blocked(user_id, recipient_id):
        raise HTTPException(status_code=403, detail="You can no longer message this user.")

    if reply_to_id is not None:
        target = await get_pool().fetchrow(
            "SELECT sender_id, recipient_id, deleted_at FROM messages WHERE id = $1", reply_to_id
        )
        in_thread = target is not None and {target["sender_id"], target["recipient_id"]} == {user_id, recipient_id}
        if not in_thread or target["deleted_at"] is not None:
            reply_to_id = None

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

    pool = get_pool()
    row = await pool.fetchrow(
        """INSERT INTO messages (sender_id, recipient_id, body, attachment_filename, attachment_storage_key, attachment_size_bytes, reply_to_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *""",
        user_id, recipient_id, text, attachment_filename, attachment_storage_key, attachment_size, reply_to_id,
    )
    message_dict = (await _attach_reply_to([dict(row)]))[0]
    message_dict["reactions"] = []

    await manager.send_to_user(recipient_id, {"type": "message", "message": message_dict})

    existing_unread = await pool.fetchval(
        "SELECT count(*)::int FROM messages WHERE sender_id = $1 AND recipient_id = $2 AND read = false AND id != $3",
        user_id, recipient_id, row["id"],
    )
    hr_comm_id = await get_hr_communications_user_id()
    if recipient_id == hr_comm_id:
        sender = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
        sender_name = sender["full_name"] if sender else "Someone"
        try:
            await create_staff_notification(
                "hr", "message", "New HR Communications Message",
                f"{sender_name} sent a message to HR Communications.", "/hr/messages",
            )
        except Exception:
            pass
    elif existing_unread == 0:
        sender = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
        sender_name = sender["full_name"] if sender else "Someone"
        try:
            await create_notification(
                recipient_id, "message", "New Message", f"{sender_name} sent you a message.", f"/portal/messages?with={user_id}"
            )
        except Exception:
            pass

    return {"message": message_dict}


@router.get("/conversations")
async def list_conversations(user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    connections = await pool.fetch(
        """SELECT u.id, u.full_name, u.profile_photo_path, u.last_active_at,
                  COALESCE(p.show_online_status, false) AS show_online_status
           FROM connections c
           JOIN users u ON u.id = (CASE WHEN c.requester_id = $1 THEN c.recipient_id ELSE c.requester_id END)
           LEFT JOIN privacy_settings p ON p.user_id = u.id
           WHERE c.status = 'accepted' AND (c.requester_id = $1 OR c.recipient_id = $1)""",
        user_id,
    )

    last_messages = await pool.fetch(
        """SELECT DISTINCT ON (partner_id) partner_id, body, attachment_filename, created_at, sender_id
           FROM (
             SELECT CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS partner_id, body, attachment_filename, created_at, sender_id
             FROM messages WHERE (sender_id = $1 OR recipient_id = $1) AND deleted_at IS NULL
           ) m
           ORDER BY partner_id, created_at DESC""",
        user_id,
    )
    last_by_partner = {r["partner_id"]: r for r in last_messages}

    unread_rows = await pool.fetch(
        "SELECT sender_id, count(*)::int AS count FROM messages WHERE recipient_id = $1 AND read = false AND deleted_at IS NULL GROUP BY sender_id",
        user_id,
    )
    unread_by_partner = {r["sender_id"]: r["count"] for r in unread_rows}

    block_rows = await pool.fetch(
        "SELECT blocker_id, blocked_id FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1", user_id
    )
    blocked_by_me = {r["blocked_id"] for r in block_rows if r["blocker_id"] == user_id}
    blocked_me = {r["blocker_id"] for r in block_rows if r["blocked_id"] == user_id}

    now = datetime.now(timezone.utc)
    conversations = []
    for u in connections:
        last = last_by_partner.get(u["id"])
        show_online = u["show_online_status"]
        last_active_at = u["last_active_at"]
        is_online = bool(show_online and last_active_at and (now - last_active_at).total_seconds() < 90)
        last_preview = None
        if last:
            last_preview = last["body"] or (f"📎 {last['attachment_filename']}" if last["attachment_filename"] else None)
        conversations.append({
            "userId": u["id"],
            "fullName": u["full_name"],
            "profilePhotoPath": u["profile_photo_path"],
            "lastMessage": last_preview,
            "lastMessageAt": last["created_at"] if last else None,
            "unread": unread_by_partner.get(u["id"], 0),
            "online": is_online,
            "lastActiveAt": last_active_at if show_online else None,
            "blockedByMe": u["id"] in blocked_by_me,
            "blockedMe": u["id"] in blocked_me,
        })

    conversations.sort(key=lambda c: (c["lastMessageAt"] is None, -(c["lastMessageAt"].timestamp()) if c["lastMessageAt"] else 0, c["fullName"]))

    return {"conversations": conversations}


@router.get("/{message_id}/attachment")
async def download_attachment(message_id: int, user_id: int = Depends(require_alumni_user_id)):
    row = await get_pool().fetchrow(
        "SELECT sender_id, recipient_id, attachment_storage_key, attachment_filename, deleted_at FROM messages WHERE id = $1",
        message_id,
    )
    if row is None or row["attachment_storage_key"] is None or row["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    if user_id not in (row["sender_id"], row["recipient_id"]):
        raise HTTPException(status_code=403, detail="You don't have access to this attachment.")
    data = storage.read_file(row["attachment_storage_key"])
    return Response(
        content=data, media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row["attachment_filename"]}"'},
    )


@router.patch("/{message_id}")
async def edit_message(message_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    text = str(body.get("body") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message body cannot be empty.")

    pool = get_pool()
    existing = await pool.fetchrow("SELECT sender_id, recipient_id, deleted_at FROM messages WHERE id = $1", message_id)
    if existing is None or existing["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if existing["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages.")

    row = await pool.fetchrow(
        "UPDATE messages SET body = $1, edited_at = now() WHERE id = $2 RETURNING *", text, message_id
    )
    message_dict = await _attach_reply_to([dict(row)])
    message_dict = await _attach_reactions(message_dict, user_id)
    message_dict = message_dict[0]

    await manager.send_to_user(existing["recipient_id"], {"type": "edited", "message": message_dict})
    return {"message": message_dict}


@router.delete("/{message_id}")
async def delete_message(message_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    existing = await pool.fetchrow(
        "SELECT sender_id, recipient_id, deleted_at FROM messages WHERE id = $1", message_id
    )
    if existing is None or existing["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if existing["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    # Soft-delete only; the attachment file is left in storage (not purged)
    # so an Undo can restore it exactly. _redact_if_deleted hides it from
    # every read path while deleted_at is set.
    await pool.execute("UPDATE messages SET deleted_at = now() WHERE id = $1", message_id)

    await manager.send_to_user(existing["recipient_id"], {"type": "deleted", "messageId": message_id, "fromUserId": user_id})
    return {"success": True}


@router.post("/{message_id}/restore")
async def restore_message(message_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    existing = await pool.fetchrow(
        "SELECT sender_id, recipient_id, deleted_at FROM messages WHERE id = $1", message_id
    )
    if existing is None or existing["deleted_at"] is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if existing["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only restore your own messages.")

    row = await pool.fetchrow("UPDATE messages SET deleted_at = NULL WHERE id = $1 RETURNING *", message_id)
    message_dict = await _attach_reply_to([dict(row)])
    message_dict = await _attach_reactions(message_dict, user_id)
    message_dict = message_dict[0]

    await manager.send_to_user(existing["recipient_id"], {"type": "restored", "message": message_dict})
    return {"message": message_dict}


@router.post("/{message_id}/reactions")
async def toggle_reaction(message_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    emoji = str(body.get("emoji") or "").strip()
    if not emoji:
        raise HTTPException(status_code=400, detail="An emoji is required.")

    pool = get_pool()
    msg = await pool.fetchrow("SELECT sender_id, recipient_id, deleted_at FROM messages WHERE id = $1", message_id)
    if msg is None or msg["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if user_id not in (msg["sender_id"], msg["recipient_id"]):
        raise HTTPException(status_code=403, detail="You don't have access to this message.")

    existing = await pool.fetchval(
        "SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
        message_id, user_id, emoji,
    )
    if existing:
        await pool.execute("DELETE FROM message_reactions WHERE id = $1", existing)
    else:
        await pool.execute(
            "INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)", message_id, user_id, emoji
        )

    other_id = msg["recipient_id"] if user_id == msg["sender_id"] else msg["sender_id"]
    reacted = await _attach_reactions([{"id": message_id}], other_id)
    reactions_for_other = reacted[0]["reactions"]
    reacted_mine = await _attach_reactions([{"id": message_id}], user_id)
    reactions_for_me = reacted_mine[0]["reactions"]

    await manager.send_to_user(other_id, {"type": "reaction", "messageId": message_id, "reactions": reactions_for_other})
    return {"reactions": reactions_for_me}


@router.post("/block/{other_user_id}")
async def block_user(other_user_id: int, user_id: int = Depends(require_alumni_user_id)):
    if other_user_id == user_id:
        raise HTTPException(status_code=400, detail="You can't block yourself.")
    await get_pool().execute(
        "INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", user_id, other_user_id
    )
    return {"success": True}


@router.delete("/block/{other_user_id}")
async def unblock_user(other_user_id: int, user_id: int = Depends(require_alumni_user_id)):
    await get_pool().execute(
        "DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2", user_id, other_user_id
    )
    return {"success": True}


@router.post("/report")
async def report_user(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    try:
        reported_id = int(body.get("userId"))
    except (TypeError, ValueError):
        reported_id = -1
    reason = str(body.get("reason") or "").strip()
    try:
        message_id = int(body.get("messageId"))
    except (TypeError, ValueError):
        message_id = None

    if reported_id < 1 or reported_id == user_id:
        raise HTTPException(status_code=400, detail="A valid user to report is required.")
    if not reason:
        raise HTTPException(status_code=400, detail="Please describe the reason for this report.")

    pool = get_pool()
    await pool.execute(
        "INSERT INTO user_reports (reporter_id, reported_id, reason, message_id) VALUES ($1, $2, $3, $4)",
        user_id, reported_id, reason, message_id,
    )

    reporter = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
    reported = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", reported_id)
    try:
        await create_staff_notification(
            "admin", "report", "User Reported",
            f"{reporter['full_name'] if reporter else 'A user'} reported {reported['full_name'] if reported else 'a user'}: {reason}",
        )
    except Exception:
        pass

    return {"success": True}
