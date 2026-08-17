from secrets import token_hex
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.datastructures import UploadFile as StarletteUploadFile

from core.config import PROJECT_ROOT
from core.db import get_pool
from core.deps import get_current_alumni_optional, get_staff_role, require_alumni_user_id, require_role
from core.notifications import create_notification
from core.sql_utils import affected_count

router = APIRouter(prefix="/api/stories")

admin_only = Depends(require_role("admin"))

AVATAR_DIR = PROJECT_ROOT / "public" / "uploads" / "stories"
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}

FIELD_MAP = {"alumniName": "alumni_name", "role": "role", "quote": "quote", "rating": "rating", "status": "status", "published": "published"}


@router.get("")
async def list_stories(
    status: Optional[str] = None,
    published: Optional[str] = None,
    submittedByEmail: Optional[str] = None,
    limit: Optional[int] = Query(None),
    staff_role: Optional[str] = Depends(get_staff_role),
    alumni: Optional[dict] = Depends(get_current_alumni_optional),
):
    is_public_view = status == "approved" and published == "true"
    if submittedByEmail:
        is_self = alumni and alumni["email"].lower() == submittedByEmail.lower()
        if not is_self and staff_role != "admin":
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
    elif not is_public_view and staff_role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")

    conditions = []
    params: list = []
    if status:
        params.append(status)
        conditions.append(f"status = ${len(params)}")
    if published is not None:
        params.append(published == "true")
        conditions.append(f"published = ${len(params)}")
    if submittedByEmail:
        params.append(submittedByEmail)
        conditions.append(f"submitted_by_email = ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    limit_clause = f"LIMIT {limit or 50}" if limit is not None else ""

    rows = await get_pool().fetch(f"SELECT * FROM stories {where} ORDER BY created_at DESC, id DESC {limit_clause}", *params)
    return {"stories": [dict(r) for r in rows]}


@router.post("", status_code=201)
async def submit_story(request: Request, user_id: int = Depends(require_alumni_user_id)):
    form = await request.form()
    alumni_name = str(form.get("alumniName") or "").strip()
    role = str(form.get("role") or "").strip() or None
    quote = str(form.get("quote") or "").strip()
    try:
        rating_raw = int(str(form.get("rating") or "5"))
    except ValueError:
        rating_raw = 5
    rating = rating_raw if 1 <= rating_raw <= 5 else 5
    submitted_by_email = str(form.get("submittedByEmail") or "").strip() or None

    if not alumni_name or not quote:
        raise HTTPException(status_code=400, detail="Name and story are required.")

    avatar_path = None
    avatar = form.get("avatar")
    if isinstance(avatar, StarletteUploadFile) and avatar.size and avatar.size > 0:
        if avatar.content_type not in ALLOWED_AVATAR_TYPES:
            raise HTTPException(status_code=400, detail="Photo must be a JPEG, PNG, or WEBP image.")
        AVATAR_DIR.mkdir(parents=True, exist_ok=True)
        ext = (avatar.content_type or "image/jpeg").split("/")[-1] or "jpg"
        filename = f"{token_hex(16)}.{ext}"
        (AVATAR_DIR / filename).write_bytes(await avatar.read())
        avatar_path = f"/uploads/stories/{filename}"

    row = await get_pool().fetchrow(
        """INSERT INTO stories (alumni_name, role, quote, avatar_path, rating, submitted_by_email, status, published)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',false) RETURNING *""",
        alumni_name, role, quote, avatar_path, rating, submitted_by_email,
    )
    return {"story": dict(row)}


@router.patch("/{story_id}", dependencies=[admin_only])
async def update_story(story_id: int, request: Request):
    form = await request.form()
    set_clauses: list[str] = []
    values: list = []

    for form_key, column in FIELD_MAP.items():
        if form_key not in form:
            continue
        value = form.get(form_key)
        if form_key == "published":
            value = value == "true"
        elif form_key == "rating":
            value = int(value)
        values.append(value)
        set_clauses.append(f"{column} = ${len(values)}")

    avatar = form.get("avatar")
    if isinstance(avatar, StarletteUploadFile) and avatar.size and avatar.size > 0:
        if avatar.content_type not in ALLOWED_AVATAR_TYPES:
            raise HTTPException(status_code=400, detail="Photo must be a JPEG, PNG, or WEBP image.")
        AVATAR_DIR.mkdir(parents=True, exist_ok=True)
        ext = (avatar.content_type or "image/jpeg").split("/")[-1] or "jpg"
        filename = f"{token_hex(16)}.{ext}"
        (AVATAR_DIR / filename).write_bytes(await avatar.read())
        values.append(f"/uploads/stories/{filename}")
        set_clauses.append(f"avatar_path = ${len(values)}")

    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")

    pool = get_pool()
    values.append(story_id)
    row = await pool.fetchrow(
        f"UPDATE stories SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Story not found.")

    if "status" in form and row["submitted_by_email"]:
        submitter = await pool.fetchrow("SELECT id FROM users WHERE email = $1", row["submitted_by_email"])
        if submitter:
            notif = None
            if row["status"] == "approved":
                notif = ("Story Approved", "Your submitted story has been approved and will appear on the site once published.")
            elif row["status"] == "rejected":
                notif = ("Story Not Approved", "Your submitted story was not approved for publishing.")
            if notif:
                try:
                    await create_notification(submitter["id"], "story", notif[0], notif[1], "/portal/stories")
                except Exception:
                    pass

    return {"story": dict(row)}


@router.delete("/{story_id}", dependencies=[admin_only])
async def delete_story(story_id: int):
    result = await get_pool().execute("DELETE FROM stories WHERE id = $1", story_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Story not found.")
    return {"success": True}
