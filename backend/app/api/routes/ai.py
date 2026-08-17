import shutil
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.base import Employee
from app.core.security import get_current_user, get_current_admin, get_effective_role
from app.services.rag_service import rag_service, check_ollama
from app.services.vector_store import vector_store
from app.services.pdf_processor import process_pdf, PDF_AVAILABLE

logger = logging.getLogger(__name__)
router = APIRouter()

PDF_DIR = Path(__file__).parent.parent.parent / "data" / "policy_pdfs"
PDF_DIR.mkdir(parents=True, exist_ok=True)


# ── Schemas ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


# ── Chat ───────────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    answer = rag_service.chat(
        question=req.message.strip(),
        user_name=f"{current_user.first_name} {current_user.last_name}",
        user_role=get_effective_role(current_user, db),
        history=[m.model_dump() for m in (req.history or [])],
    )

    hits = vector_store.query(req.message.strip(), n_results=4)
    sources = sorted({h["source"] for h in hits})

    return ChatResponse(answer=answer, sources=sources)


# ── Policy management (admin only) ────────────────────────────────────────────

@router.post("/upload-policy")
async def upload_policy(
    file: UploadFile = File(...),
    current_user: Employee = Depends(get_current_admin),
):
    """Upload a PDF and index it into the vector store."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    if not PDF_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="pdfplumber is not installed on the server. Run: pip install pdfplumber",
        )

    # Sanitise filename
    safe_name = file.filename.replace(" ", "_").replace("..", "_")
    dest = PDF_DIR / safe_name

    # Save to disk
    try:
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    # Extract & index
    try:
        chunks = process_pdf(str(dest))
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"PDF processing failed: {exc}")

    if not chunks:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail="Could not extract any text from the PDF. "
                   "Ensure the PDF contains selectable text (not a scanned image).",
        )

    source_name = Path(safe_name).stem

    # Re-index if already present
    if vector_store.source_exists(source_name):
        vector_store.delete_source(source_name)
        logger.info("Re-indexing existing source '%s'", source_name)

    vector_store.add_chunks(chunks)

    return {
        "message":        f"'{file.filename}' indexed successfully.",
        "source":         source_name,
        "chunks_indexed": len(chunks),
        "pages":          max((c.get("page", 0) for c in chunks), default=0),
    }


@router.get("/sources")
def list_sources(current_user: Employee = Depends(get_current_user)):
    """List all indexed policy sources and total chunk count."""
    return {
        "sources":      rag_service.get_sources(),
        "total_chunks": vector_store.count(),
    }


@router.delete("/sources/{source_name}")
def delete_source(
    source_name: str,
    current_user: Employee = Depends(get_current_admin),
):
    """Remove a source and all its chunks from the vector store."""
    if not vector_store.source_exists(source_name):
        raise HTTPException(
            status_code=404,
            detail=f"Source '{source_name}' not found in vector store.",
        )

    vector_store.delete_source(source_name)

    # Also remove PDF file from disk if present
    for ext in (".pdf", ".PDF"):
        pdf_file = PDF_DIR / (source_name + ext)
        pdf_file.unlink(missing_ok=True)

    return {"message": f"Source '{source_name}' deleted.", "source": source_name}


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health")
def ai_health(current_user: Employee = Depends(get_current_user)):
    ollama_status = check_ollama(rag_service.base_url, rag_service.model)
    return {
        "status":             "ok",
        "vector_store_ready": vector_store.is_ready,
        "total_chunks":       vector_store.count(),
        "sources":            rag_service.get_sources(),
        "ollama":             ollama_status,
        "pdf_support":        PDF_AVAILABLE,
    }
