from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from starlette.datastructures import UploadFile as StarletteUploadFile

from core import storage
from core.db import get_pool
from core.deps import require_alumni_user_id
from core.notifications import create_notification
from core.ws_manager import manager
from routers.messages import MAX_ATTACHMENT_SIZE_BYTES

router = APIRouter(prefix="/api/groups")


async def _is_group_member(group_id: int, user_id: int) -> bool:
    row = await get_pool().fetchrow(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2", group_id, user_id
    )
    return row is not None


async def _is_active_alumni(user_id: int) -> bool:
    row = await get_pool().fetchrow("SELECT 1 FROM users WHERE id = $1 AND status = 'active'", user_id)
    return row is not None


async def _group_member_ids(group_id: int) -> list[int]:
    rows = await get_pool().fetch("SELECT user_id FROM group_members WHERE group_id = $1", group_id)
    return [r["user_id"] for r in rows]


async def _broadcast_to_group(group_id: int, exclude_user_id: int, payload: dict) -> None:
    for uid in await _group_member_ids(group_id):
        if uid != exclude_user_id:
            await manager.send_to_user(uid, payload)


def _redact_if_deleted(msg: dict) -> dict:
    if msg.get("deleted_at"):
        msg["body"] = None
        msg["attachment_filename"] = None
        msg["attachment_storage_key"] = None
        msg["attachment_size_bytes"] = None
    return msg


async def _attach_reply_to(messages: list[dict]) -> list[dict]:
    reply_ids = [m["reply_to_id"] for m in messages if m.get("reply_to_id")]
    if not reply_ids:
        for m in messages:
            m["reply_to"] = None
        return messages
    rows = await get_pool().fetch(
        "SELECT id, sender_id, body, attachment_filename, deleted_at FROM group_messages WHERE id = ANY($1::int[])",
        reply_ids,
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
        "SELECT message_id, emoji, user_id FROM group_message_reactions WHERE message_id = ANY($1::int[])", ids
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


async def _member_summaries(group_id: int) -> list[dict]:
    rows = await get_pool().fetch(
        """SELECT u.id, u.full_name, u.profile_photo_path FROM group_members gm
           JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1 ORDER BY u.full_name""",
        group_id,
    )
    return [{"userId": r["id"], "fullName": r["full_name"], "profilePhotoPath": r["profile_photo_path"]} for r in rows]


@router.post("", status_code=201)
async def create_group(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    name = str(body.get("name") or "").strip()
    raw_member_ids = body.get("memberIds") or []
    if not name:
        raise HTTPException(status_code=400, detail="A group name is required.")
    if not isinstance(raw_member_ids, list) or not raw_member_ids:
        raise HTTPException(status_code=400, detail="Select at least one member.")

    valid_member_ids = set()
    for raw_id in raw_member_ids:
        try:
            member_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if member_id != user_id and await _is_active_alumni(member_id):
            valid_member_ids.add(member_id)
    if not valid_member_ids:
        raise HTTPException(status_code=400, detail="None of the selected members are valid alumni accounts.")

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            group = await conn.fetchrow(
                "INSERT INTO group_conversations (name, created_by) VALUES ($1, $2) RETURNING *", name, user_id
            )
            for member_id in valid_member_ids | {user_id}:
                await conn.execute(
                    "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    group["id"], member_id,
                )

    group_payload = {
        "id": group["id"], "name": group["name"], "createdBy": group["created_by"],
        "createdAt": group["created_at"], "members": await _member_summaries(group["id"]),
        "lastMessage": None, "lastMessageAt": None, "unread": 0,
    }
    for member_id in valid_member_ids:
        await manager.send_to_user(member_id, {"type": "group_created", "group": group_payload})
        try:
            await create_notification(member_id, "message", "Added to a group", f'You were added to "{name}".', "/portal/messages")
        except Exception:
            pass

    return {"group": group_payload}


@router.get("")
async def list_groups(user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    groups = await pool.fetch(
        """SELECT gc.* FROM group_conversations gc
           JOIN group_members gm ON gm.group_id = gc.id
           WHERE gm.user_id = $1""",
        user_id,
    )
    result = []
    for g in groups:
        last = await pool.fetchrow(
            """SELECT body, attachment_filename, sender_id, created_at FROM group_messages
               WHERE group_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1""",
            g["id"],
        )
        read = await pool.fetchrow(
            "SELECT last_read_message_id FROM group_reads WHERE group_id = $1 AND user_id = $2", g["id"], user_id
        )
        last_read_id = read["last_read_message_id"] if read else None
        unread = await pool.fetchval(
            """SELECT count(*)::int FROM group_messages WHERE group_id = $1 AND sender_id != $2
               AND deleted_at IS NULL AND ($3::int IS NULL OR id > $3)""",
            g["id"], user_id, last_read_id,
        )
        preview = None
        if last:
            preview = last["body"] or (f"📎 {last['attachment_filename']}" if last["attachment_filename"] else None)
        result.append({
            "id": g["id"], "name": g["name"], "createdBy": g["created_by"], "createdAt": g["created_at"],
            "members": await _member_summaries(g["id"]),
            "lastMessage": preview, "lastMessageAt": last["created_at"] if last else g["created_at"],
            "unread": unread or 0,
        })
    result.sort(key=lambda g: g["lastMessageAt"], reverse=True)
    return {"groups": result}


@router.get("/{group_id}")
async def get_group_thread(group_id: int, user_id: int = Depends(require_alumni_user_id)):
    if not await _is_group_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="You're not a member of this group.")

    pool = get_pool()
    group = await pool.fetchrow("SELECT * FROM group_conversations WHERE id = $1", group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found.")

    rows = await pool.fetch("SELECT * FROM group_messages WHERE group_id = $1 ORDER BY created_at ASC", group_id)
    messages = [_redact_if_deleted(dict(r)) for r in rows]
    messages = await _attach_reply_to(messages)
    messages = await _attach_reactions(messages, user_id)

    if messages:
        await pool.execute(
            """INSERT INTO group_reads (group_id, user_id, last_read_message_id) VALUES ($1, $2, $3)
               ON CONFLICT (group_id, user_id) DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id""",
            group_id, user_id, messages[-1]["id"],
        )

    return {
        "group": {"id": group["id"], "name": group["name"], "createdBy": group["created_by"], "createdAt": group["created_at"]},
        "members": await _member_summaries(group_id),
        "messages": messages,
    }


@router.post("/{group_id}/messages", status_code=201)
async def send_group_message(group_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    if not await _is_group_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="You're not a member of this group.")

    form = await request.form()
    text = str(form.get("body") or "").strip() or None
    raw_file = form.get("file")
    file = raw_file if isinstance(raw_file, StarletteUploadFile) and raw_file.filename else None
    try:
        reply_to_id = int(form.get("replyToMessageId"))
    except (TypeError, ValueError):
        reply_to_id = None

    if not text and not file:
        raise HTTPException(status_code=400, detail="Message must have text or a file attached.")

    if reply_to_id is not None:
        target = await get_pool().fetchrow(
            "SELECT group_id, deleted_at FROM group_messages WHERE id = $1", reply_to_id
        )
        if target is None or target["group_id"] != group_id or target["deleted_at"] is not None:
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
        """INSERT INTO group_messages (group_id, sender_id, body, attachment_filename, attachment_storage_key, attachment_size_bytes, reply_to_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *""",
        group_id, user_id, text, attachment_filename, attachment_storage_key, attachment_size, reply_to_id,
    )
    message_dict = (await _attach_reply_to([dict(row)]))[0]
    message_dict["reactions"] = []

    await pool.execute(
        """INSERT INTO group_reads (group_id, user_id, last_read_message_id) VALUES ($1, $2, $3)
           ON CONFLICT (group_id, user_id) DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id""",
        group_id, user_id, row["id"],
    )

    await _broadcast_to_group(group_id, user_id, {"type": "group_message", "groupId": group_id, "message": message_dict})

    sender = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
    group = await pool.fetchrow("SELECT name FROM group_conversations WHERE id = $1", group_id)
    sender_name = sender["full_name"] if sender else "Someone"
    for member_id in await _group_member_ids(group_id):
        if member_id == user_id:
            continue
        try:
            await create_notification(
                member_id, "message", group["name"], f"{sender_name}: {text or '📎 attachment'}", f"/portal/messages?group={group_id}"
            )
        except Exception:
            pass

    return {"message": message_dict}


@router.get("/{group_id}/messages/{message_id}/attachment")
async def download_group_attachment(group_id: int, message_id: int, user_id: int = Depends(require_alumni_user_id)):
    if not await _is_group_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="You're not a member of this group.")
    row = await get_pool().fetchrow(
        "SELECT attachment_storage_key, attachment_filename, deleted_at FROM group_messages WHERE id = $1 AND group_id = $2",
        message_id, group_id,
    )
    if row is None or row["attachment_storage_key"] is None or row["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    data = storage.read_file(row["attachment_storage_key"])
    return Response(
        content=data, media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row["attachment_filename"]}"'},
    )


@router.patch("/{group_id}/messages/{message_id}")
async def edit_group_message(group_id: int, message_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    text = str(body.get("body") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message body cannot be empty.")

    pool = get_pool()
    existing = await pool.fetchrow(
        "SELECT sender_id, deleted_at FROM group_messages WHERE id = $1 AND group_id = $2", message_id, group_id
    )
    if existing is None or existing["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if existing["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages.")

    row = await pool.fetchrow(
        "UPDATE group_messages SET body = $1, edited_at = now() WHERE id = $2 RETURNING *", text, message_id
    )
    message_dict = await _attach_reply_to([dict(row)])
    message_dict = await _attach_reactions(message_dict, user_id)
    message_dict = message_dict[0]

    await _broadcast_to_group(group_id, user_id, {"type": "group_edited", "groupId": group_id, "message": message_dict})
    return {"message": message_dict}


@router.delete("/{group_id}/messages/{message_id}")
async def delete_group_message(group_id: int, message_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    existing = await pool.fetchrow(
        "SELECT sender_id, deleted_at FROM group_messages WHERE id = $1 AND group_id = $2", message_id, group_id
    )
    if existing is None or existing["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if existing["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    await pool.execute("UPDATE group_messages SET deleted_at = now() WHERE id = $1", message_id)
    await _broadcast_to_group(group_id, user_id, {"type": "group_deleted", "groupId": group_id, "messageId": message_id, "fromUserId": user_id})
    return {"success": True}


@router.post("/{group_id}/messages/{message_id}/restore")
async def restore_group_message(group_id: int, message_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    existing = await pool.fetchrow(
        "SELECT sender_id, deleted_at FROM group_messages WHERE id = $1 AND group_id = $2", message_id, group_id
    )
    if existing is None or existing["deleted_at"] is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if existing["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only restore your own messages.")

    row = await pool.fetchrow("UPDATE group_messages SET deleted_at = NULL WHERE id = $1 RETURNING *", message_id)
    message_dict = await _attach_reply_to([dict(row)])
    message_dict = await _attach_reactions(message_dict, user_id)
    message_dict = message_dict[0]

    await _broadcast_to_group(group_id, user_id, {"type": "group_restored", "groupId": group_id, "message": message_dict})
    return {"message": message_dict}


@router.post("/{group_id}/messages/{message_id}/reactions")
async def toggle_group_reaction(group_id: int, message_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    if not await _is_group_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="You're not a member of this group.")

    body = await request.json()
    emoji = str(body.get("emoji") or "").strip()
    if not emoji:
        raise HTTPException(status_code=400, detail="An emoji is required.")

    pool = get_pool()
    msg = await pool.fetchrow(
        "SELECT deleted_at FROM group_messages WHERE id = $1 AND group_id = $2", message_id, group_id
    )
    if msg is None or msg["deleted_at"] is not None:
        raise HTTPException(status_code=404, detail="Message not found.")

    existing = await pool.fetchval(
        "SELECT id FROM group_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
        message_id, user_id, emoji,
    )
    if existing:
        await pool.execute("DELETE FROM group_message_reactions WHERE id = $1", existing)
    else:
        await pool.execute(
            "INSERT INTO group_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)", message_id, user_id, emoji
        )

    for member_id in await _group_member_ids(group_id):
        reactions = (await _attach_reactions([{"id": message_id}], member_id))[0]["reactions"]
        if member_id == user_id:
            reactions_for_me = reactions
        else:
            await manager.send_to_user(member_id, {"type": "group_reaction", "groupId": group_id, "messageId": message_id, "reactions": reactions})

    return {"reactions": reactions_for_me}


@router.post("/{group_id}/members")
async def add_group_members(group_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    if not await _is_group_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="You're not a member of this group.")

    body = await request.json()
    raw_member_ids = body.get("memberIds") or []
    if not isinstance(raw_member_ids, list) or not raw_member_ids:
        raise HTTPException(status_code=400, detail="Select at least one member to add.")

    pool = get_pool()
    group = await pool.fetchrow("SELECT name FROM group_conversations WHERE id = $1", group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found.")

    added = []
    for raw_id in raw_member_ids:
        try:
            member_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if member_id == user_id or await _is_group_member(group_id, member_id):
            continue
        if not await _is_active_alumni(member_id):
            continue
        await pool.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", group_id, member_id
        )
        added.append(member_id)

    if not added:
        raise HTTPException(status_code=400, detail="None of the selected members could be added.")

    members = await _member_summaries(group_id)
    for member_id in await _group_member_ids(group_id):
        await manager.send_to_user(member_id, {"type": "group_members_updated", "groupId": group_id, "members": members})
    for member_id in added:
        try:
            await create_notification(member_id, "message", "Added to a group", f'You were added to "{group["name"]}".', "/portal/messages")
        except Exception:
            pass

    return {"members": members}


@router.delete("/{group_id}/members/me")
async def leave_group(group_id: int, user_id: int = Depends(require_alumni_user_id)):
    if not await _is_group_member(group_id, user_id):
        raise HTTPException(status_code=404, detail="Group not found.")

    pool = get_pool()
    remaining_before = await _group_member_ids(group_id)
    await pool.execute("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", group_id, user_id)

    members = await _member_summaries(group_id)
    for member_id in remaining_before:
        if member_id != user_id:
            await manager.send_to_user(member_id, {"type": "group_member_left", "groupId": group_id, "userId": user_id, "members": members})

    return {"success": True}
