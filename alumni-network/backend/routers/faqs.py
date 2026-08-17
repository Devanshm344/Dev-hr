from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core.db import get_pool
from core.deps import require_role
from core.sql_utils import affected_count, build_set_clause

router = APIRouter(prefix="/api/faqs")

admin_only = Depends(require_role("admin"))

FIELD_MAP = {"question": "question", "answer": "answer", "published": "published", "displayOrder": "display_order"}


@router.get("")
async def list_faqs(published: Optional[str] = None):
    conditions = []
    params: list = []
    if published is not None:
        params.append(published == "true")
        conditions.append(f"published = ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = await get_pool().fetch(f"SELECT * FROM faqs {where} ORDER BY display_order ASC, id ASC", *params)
    return {"faqs": [dict(r) for r in rows]}


@router.post("", status_code=201, dependencies=[admin_only])
async def create_faq(request: Request):
    body = await request.json()
    question = str(body.get("question") or "").strip()
    answer = str(body.get("answer") or "").strip()
    published = body.get("published") is not False

    if not question or not answer:
        raise HTTPException(status_code=400, detail="Question and answer are required.")

    pool = get_pool()
    next_order = await pool.fetchval("SELECT COALESCE(MAX(display_order), -1) + 1 FROM faqs")
    row = await pool.fetchrow(
        "INSERT INTO faqs (question, answer, display_order, published) VALUES ($1,$2,$3,$4) RETURNING *",
        question, answer, next_order, published,
    )
    return {"faq": dict(row)}


@router.patch("/{faq_id}", dependencies=[admin_only])
async def update_faq(faq_id: int, request: Request):
    body = await request.json()
    set_clauses, values = build_set_clause(FIELD_MAP, body)
    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")
    values.append(faq_id)
    row = await get_pool().fetchrow(
        f"UPDATE faqs SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
    )
    if row is None:
        raise HTTPException(status_code=404, detail="FAQ not found.")
    return {"faq": dict(row)}


@router.delete("/{faq_id}", dependencies=[admin_only])
async def delete_faq(faq_id: int):
    result = await get_pool().execute("DELETE FROM faqs WHERE id = $1", faq_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="FAQ not found.")
    return {"success": True}
