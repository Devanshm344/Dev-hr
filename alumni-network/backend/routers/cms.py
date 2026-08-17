import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from core.db import get_pool
from core.deps import require_role
from core.sql_utils import affected_count, build_set_clause

router = APIRouter(prefix="/api/cms")

admin_only = Depends(require_role("admin"))

FIELD_MAP = {"title": "title", "slug": "slug", "type": "type", "content": "content", "status": "status"}


@router.get("/pages", dependencies=[admin_only])
async def list_pages():
    rows = await get_pool().fetch("SELECT id, title, slug, type, content, status, created_at, updated_at FROM cms_pages ORDER BY created_at ASC")
    return {"pages": [dict(r) for r in rows]}


@router.post("/pages", status_code=201, dependencies=[admin_only])
async def create_page(request: Request):
    body = await request.json()
    title = str(body.get("title") or "").strip()
    slug = str(body.get("slug") or "").strip()
    type_ = str(body.get("type") or "Page").strip()
    content = str(body.get("content") or "")
    status = "published" if body.get("status") == "published" else "draft"

    if not title or not slug.startswith("/"):
        raise HTTPException(status_code=400, detail="Title and a slug starting with / are required.")

    try:
        row = await get_pool().fetchrow(
            "INSERT INTO cms_pages (title, slug, type, content, status) VALUES ($1,$2,$3,$4,$5) RETURNING *",
            title, slug, type_, content, status,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="A page with this slug already exists.")
    return {"page": dict(row)}


@router.patch("/pages/{page_id}", dependencies=[admin_only])
async def update_page(page_id: int, request: Request):
    body = await request.json()
    set_clauses, values = build_set_clause(FIELD_MAP, body)
    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")
    values.append(page_id)
    try:
        row = await get_pool().fetchrow(
            f"UPDATE cms_pages SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="A page with this slug already exists.")
    if row is None:
        raise HTTPException(status_code=404, detail="Page not found.")
    return {"page": dict(row)}


@router.delete("/pages/{page_id}", dependencies=[admin_only])
async def delete_page(page_id: int):
    result = await get_pool().execute("DELETE FROM cms_pages WHERE id = $1", page_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Page not found.")
    return {"success": True}
