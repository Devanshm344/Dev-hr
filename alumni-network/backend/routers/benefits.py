from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from starlette.datastructures import UploadFile as StarletteUploadFile

from core import storage
from core.db import get_pool
from core.deps import get_current_alumni, get_session, require_role
from core.sql_utils import affected_count, build_set_clause

router = APIRouter(prefix="/api/benefits")

staff_only = Depends(require_role("hr", "admin"))

MAX_RESOURCE_SIZE_BYTES = 50 * 1024 * 1024

FIELD_MAP = {"title": "title", "description": "description", "category": "category", "icon": "icon", "color": "color", "active": "active"}


@router.get("")
async def list_benefits(active: Optional[str] = None, search: Optional[str] = None):
    conditions = []
    params: list = []
    if active is not None:
        params.append(active == "true")
        conditions.append(f"active = ${len(params)}")
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"(title ILIKE ${len(params)} OR category ILIKE ${len(params)})")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = await get_pool().fetch(f"SELECT * FROM benefits {where} ORDER BY category ASC, title ASC", *params)
    return {"benefits": [dict(r) for r in rows]}


@router.post("", status_code=201, dependencies=[staff_only])
async def create_benefit(request: Request):
    body = await request.json()
    title = str(body.get("title") or "").strip()
    description = str(body.get("description") or "").strip()
    category = str(body.get("category") or "").strip()
    icon = str(body.get("icon") or "Gift").strip()
    color = str(body.get("color") or "blue").strip()
    active = body.get("active") is not False

    if not title or not description or not category:
        raise HTTPException(status_code=400, detail="Title, description, and category are required.")

    row = await get_pool().fetchrow(
        "INSERT INTO benefits (title, description, category, icon, color, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        title, description, category, icon, color, active,
    )
    return {"benefit": dict(row)}


@router.patch("/{benefit_id}", dependencies=[staff_only])
async def update_benefit(benefit_id: int, request: Request):
    body = await request.json()
    set_clauses, values = build_set_clause(FIELD_MAP, body)
    if not set_clauses:
        raise HTTPException(status_code=400, detail="No fields to update.")
    values.append(benefit_id)
    row = await get_pool().fetchrow(
        f"UPDATE benefits SET {', '.join(set_clauses)}, updated_at = now() WHERE id = ${len(values)} RETURNING *", *values
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Benefit not found.")
    return {"benefit": dict(row)}


@router.delete("/{benefit_id}", dependencies=[staff_only])
async def delete_benefit(benefit_id: int):
    pool = get_pool()
    request_count = await pool.fetchval("SELECT count(*)::int FROM service_requests WHERE benefit_id = $1", benefit_id)
    if request_count > 0:
        plural = "" if request_count == 1 else "s"
        raise HTTPException(status_code=409, detail=f"This benefit has {request_count} existing request{plural} and can't be deleted — deactivate it instead.")
    result = await pool.execute("DELETE FROM benefits WHERE id = $1", benefit_id)
    if affected_count(result) == 0:
        raise HTTPException(status_code=404, detail="Benefit not found.")
    return {"success": True}


@router.get("/{benefit_id}/resources", dependencies=[staff_only])
async def list_benefit_resources(benefit_id: int):
    rows = await get_pool().fetch(
        "SELECT id, original_filename, file_size_bytes, uploaded_at FROM benefit_resources WHERE benefit_id = $1 ORDER BY uploaded_at DESC",
        benefit_id,
    )
    return {"resources": [dict(r) for r in rows]}


@router.post("/{benefit_id}/resources")
async def upload_benefit_resources(benefit_id: int, request: Request, staff: dict = staff_only):
    pool = get_pool()
    benefit = await pool.fetchrow("SELECT id FROM benefits WHERE id = $1", benefit_id)
    if benefit is None:
        raise HTTPException(status_code=404, detail="Benefit not found.")

    form = await request.form()
    files = [f for f in form.getlist("files") if isinstance(f, StarletteUploadFile) and f.filename]
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    inserted_ids = []
    for file in files:
        data = await file.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f'"{file.filename}" is empty.')
        if len(data) > MAX_RESOURCE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail=f'"{file.filename}" exceeds the 50MB limit.')

        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
        storage_key = storage.save_file(data, "benefit_resources", ext)
        resource_id = await pool.fetchval(
            """INSERT INTO benefit_resources (benefit_id, original_filename, storage_key, file_size_bytes, uploaded_by)
               VALUES ($1,$2,$3,$4,$5) RETURNING id""",
            benefit_id, file.filename, storage_key, len(data), staff["id"],
        )
        inserted_ids.append(resource_id)

    return {"ids": inserted_ids}


@router.delete("/resources/{resource_id}", dependencies=[staff_only])
async def delete_benefit_resource(resource_id: int):
    row = await get_pool().fetchrow("SELECT storage_key FROM benefit_resources WHERE id = $1", resource_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Resource not found.")
    await get_pool().execute("DELETE FROM benefit_resources WHERE id = $1", resource_id)
    storage.delete_file(row["storage_key"])
    return {"success": True}


@router.get("/{benefit_id}/my-resources")
async def my_benefit_resources(benefit_id: int, user: dict = Depends(get_current_alumni)):
    benefit = await get_pool().fetchrow("SELECT id FROM benefits WHERE id = $1", benefit_id)
    if benefit is None:
        raise HTTPException(status_code=404, detail="Benefit not found.")

    rows = await get_pool().fetch(
        "SELECT id, original_filename, file_size_bytes, uploaded_at FROM benefit_resources WHERE benefit_id = $1 ORDER BY uploaded_at DESC",
        benefit_id,
    )
    return {"resources": [dict(r) for r in rows]}


@router.get("/resources/{resource_id}/download")
async def download_benefit_resource(resource_id: int, session=Depends(get_session)):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    row = await get_pool().fetchrow(
        "SELECT benefit_id, storage_key, original_filename FROM benefit_resources WHERE id = $1", resource_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Resource not found.")

    if session["role"] not in ("alumni", "hr", "admin"):
        raise HTTPException(status_code=401, detail="Not authenticated.")

    data = storage.read_file(row["storage_key"])
    return Response(
        content=data, media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row["original_filename"]}"'},
    )
