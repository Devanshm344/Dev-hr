from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from core import storage
from core.audit import log_audit
from core.db import get_pool
from core.deps import get_current_alumni

router = APIRouter(prefix="/api/documents")


@router.get("")
async def list_my_documents(user: dict = Depends(get_current_alumni)):
    rows = await get_pool().fetch(
        """SELECT id, doc_type, period_label, original_filename, file_size_bytes, uploaded_at
           FROM alumni_documents WHERE alumni_id = $1 ORDER BY uploaded_at DESC""",
        user["id"],
    )
    return {"documents": [dict(r) for r in rows]}


@router.get("/{document_id}/download")
async def download_document(document_id: int, request: Request, user: dict = Depends(get_current_alumni)):
    row = await get_pool().fetchrow(
        "SELECT storage_key, original_filename FROM alumni_documents WHERE id = $1 AND alumni_id = $2",
        document_id, user["id"],
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    data = storage.read_file(row["storage_key"])
    try:
        await log_audit("alumni", user["email"], "Downloaded Salary Certificate", "documents", "success", request)
    except Exception:
        pass

    return Response(
        content=data, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{row["original_filename"]}"'},
    )
