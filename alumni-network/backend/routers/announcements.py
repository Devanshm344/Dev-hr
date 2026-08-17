from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from core.db import get_pool
from core.deps import require_role
from core.sql_utils import affected_count, build_set_clause

router = APIRouter(prefix="/api/announcements")

staff_only = Depends(require_role("hr", "admin"))

FIELD_MAP = {"title": "title", "content": "content", "author": "author", "priority": "priority", "published": "published"}


@router.get("")
async def list_announcements(published: Optional[str] = None, limit: Optional[int] = Query(None)):
    conditions = []
    params: list = []
    if published is not None:
        params.append(published == "true")
        conditions.append(f"published = ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    limit_clause = f"LIMIT {limit or 20}" if limit is not None else ""

    rows = await get_pool().fetch(f"SELECT * FROM announcements {where} ORDER BY created_at DESC {limit_clause}", *params)
    return {"announcements": [dict(r) for r in rows]}


@router.post("", status_code=201, dependencies=[staff_only])
async def create_announcement(request: Request):
    body = await request.json()
    title = str(body.get("title") or "").strip()
    content = str(body.get("content") or "").strip()
    author = str(body.get("author") or "").strip()
    priority = str(body.get("priority") or "medium").strip()
    published = body.get("published") is not False

    if not title or not content or not author:
        raise HTTPException(status_code=400, detail="Title, content, and author are required.")

    row = await get_pool().fetchrow(
        "INSERT INTO announcements (title, content, author, priority, published) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        title, content, author, priority, published,
    )
    return {"announcement": dict(row)}


@router.patch("/{announcement_id}", dependencies=[staff_only])
async def update_announcement(announcement_id: int, request: Request):
    body = await request.json()
    set_clauses, values = build_set_clause(FIELD_MAP, body)
    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")
    values.append(announcement_id)
    row = await get_pool().fetchrow(
        f"UPDATE announcements SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    return {"announcement": dict(row)}


@router.delete("/{announcement_id}", dependencies=[staff_only])
async def delete_announcement(announcement_id: int):
    result = await get_pool().execute("DELETE FROM announcements WHERE id = $1", announcement_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    return {"success": True}
