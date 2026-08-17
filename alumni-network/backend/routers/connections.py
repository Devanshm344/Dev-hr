from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from core.db import get_pool
from core.deps import require_alumni_user_id
from core.notifications import create_notification

router = APIRouter(prefix="/api/connections")


@router.get("")
async def list_connections(user_id: int = Depends(require_alumni_user_id)):
    rows = await get_pool().fetch(
        """SELECT c.id, c.requester_id, c.recipient_id, c.status, c.created_at,
                  u.id AS counterpart_id, u.full_name AS counterpart_name, u.employer AS counterpart_employer,
                  u.designation AS counterpart_designation, u.profile_photo_path AS counterpart_photo
           FROM connections c
           JOIN users u ON u.id = (CASE WHEN c.requester_id = $1 THEN c.recipient_id ELSE c.requester_id END)
           WHERE c.requester_id = $1 OR c.recipient_id = $1
           ORDER BY c.created_at DESC""",
        user_id,
    )
    connections = [
        {
            "id": r["id"],
            "status": r["status"],
            "direction": "outgoing" if r["requester_id"] == user_id else "incoming",
            "counterpart": {
                "id": r["counterpart_id"],
                "fullName": r["counterpart_name"],
                "employer": r["counterpart_employer"],
                "designation": r["counterpart_designation"],
                "profilePhotoPath": r["counterpart_photo"],
            },
            "createdAt": r["created_at"],
        }
        for r in rows
    ]
    return {"connections": connections}


@router.post("")
async def create_connection(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    try:
        recipient_id = int(body.get("recipientId"))
    except (TypeError, ValueError):
        recipient_id = -1
    if recipient_id == user_id or recipient_id < 1:
        raise HTTPException(status_code=400, detail="Invalid recipient.")

    pool = get_pool()
    recipient = await pool.fetchrow(
        """SELECT u.id, u.full_name, COALESCE(ps.allow_connection_requests, true) AS allow_connection_requests
           FROM users u LEFT JOIN privacy_settings ps ON ps.user_id = u.id WHERE u.id = $1""",
        recipient_id,
    )
    if not recipient:
        raise HTTPException(status_code=404, detail="Alumni not found.")
    if not recipient["allow_connection_requests"]:
        raise HTTPException(status_code=403, detail="This alumnus isn't accepting connection requests right now.")

    requester = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
    requester_name = requester["full_name"] if requester else "An alumnus"

    existing = await pool.fetchrow(
        "SELECT * FROM connections WHERE (requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1)",
        user_id, recipient_id,
    )

    if existing:
        if existing["status"] == "accepted":
            raise HTTPException(status_code=409, detail="You're already connected.")
        if existing["requester_id"] == user_id:
            return {"connection": dict(existing)}
        updated = await pool.fetchrow(
            "UPDATE connections SET status = 'accepted', updated_at = now() WHERE id = $1 RETURNING *", existing["id"]
        )
        try:
            await create_notification(
                existing["requester_id"], "connection", "Connection Accepted",
                f"{requester_name} accepted your connection request.", "/portal/networking",
            )
        except Exception:
            pass
        return {"connection": dict(updated)}

    inserted = await pool.fetchrow(
        "INSERT INTO connections (requester_id, recipient_id, status) VALUES ($1, $2, 'pending') RETURNING *",
        user_id, recipient_id,
    )
    try:
        await create_notification(
            recipient_id, "connection", "New Connection Request",
            f"{requester_name} wants to connect with you.", "/portal/networking",
        )
    except Exception:
        pass
    return JSONResponse(jsonable_encoder({"connection": dict(inserted)}), status_code=201)


@router.patch("/{connection_id}")
async def respond_to_connection(connection_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    status = body.get("status")
    if status not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="Invalid status.")

    pool = get_pool()
    row = await pool.fetchrow("SELECT * FROM connections WHERE id = $1", connection_id)
    if not row:
        raise HTTPException(status_code=404, detail="Connection not found.")
    if row["recipient_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the recipient can respond to this request.")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail="This request has already been responded to.")

    updated = await pool.fetchrow(
        "UPDATE connections SET status = $1, updated_at = now() WHERE id = $2 RETURNING *", status, connection_id
    )

    if status == "accepted":
        recipient = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
        recipient_name = recipient["full_name"] if recipient else "An alumnus"
        try:
            await create_notification(
                row["requester_id"], "connection", "Connection Accepted",
                f"{recipient_name} accepted your connection request.", "/portal/networking",
            )
        except Exception:
            pass

    return {"connection": dict(updated)}
