"""
PDF → text chunks pipeline.

Strategy:
  1. Extract text page-by-page with pdfplumber (handles tables, columns).
  2. Clean: normalize whitespace, remove header/footer noise.
  3. Split each page on paragraph breaks, then merge paragraphs into
     fixed-size chunks (≤ CHUNK_SIZE chars) with OVERLAP carry-over.
  4. Each chunk carries {text, source, page, chunk_index} metadata.
"""
import re
import logging
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger(__name__)

CHUNK_SIZE = 900      # max characters per chunk
CHUNK_OVERLAP = 180   # characters carried into the next chunk

try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logger.warning("pdfplumber not installed — PDF indexing unavailable")


# ── Text cleaning ──────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)           # collapse spaces/tabs
    text = re.sub(r"(\n[ \t]*){3,}", "\n\n", text) # max 2 consecutive newlines
    text = re.sub(r"-\n(\w)", r"\1", text)          # re-join hyphenated line breaks
    return text.strip()


def _looks_like_noise(line: str) -> bool:
    """Return True for lines that are likely headers/footers/page numbers."""
    stripped = line.strip()
    if not stripped:
        return False
    if re.fullmatch(r"\d+", stripped):              # bare page number
        return True
    if re.fullmatch(r"page\s+\d+\s*(of\s+\d+)?", stripped, re.I):
        return True
    if len(stripped) < 4 and not stripped.isalpha():
        return True
    return False


def _extract_pages(pdf_path: str) -> List[Dict]:
    """Return list of {page: int, text: str} for non-empty pages."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            raw = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
            lines = [ln for ln in raw.splitlines() if not _looks_like_noise(ln)]
            text = _clean("\n".join(lines))
            if text:
                pages.append({"page": i, "text": text})
    return pages


# ── Chunking ───────────────────────────────────────────────────────────────────

def _chunk_text(text: str, source: str, page: int,
                start_index: int) -> List[Dict]:
    """
    Split a single page's text into overlapping chunks.
    Returns a list of chunk dicts.
    """
    # Prefer paragraph-level splits; fall back to sentence splits.
    paragraphs = [p.strip() for p in re.split(r"\n\n+", text) if p.strip()]
    if not paragraphs:
        return []

    chunks: List[Dict] = []
    current = ""
    chunk_idx = start_index

    for para in paragraphs:
        candidate = (current + "\n\n" + para).strip() if current else para

        if len(candidate) <= CHUNK_SIZE:
            current = candidate
        else:
            # Flush current (if non-empty)
            if current:
                chunks.append({
                    "text": current,
                    "source": source,
                    "page": page,
                    "chunk_index": chunk_idx,
                })
                chunk_idx += 1
                # Carry overlap: last N chars of current
                overlap_text = current[-CHUNK_OVERLAP:].lstrip()
                current = (overlap_text + "\n\n" + para).strip()
            else:
                # Single paragraph bigger than CHUNK_SIZE — hard-split it
                for offset in range(0, len(para), CHUNK_SIZE - CHUNK_OVERLAP):
                    piece = para[offset: offset + CHUNK_SIZE].strip()
                    if piece:
                        chunks.append({
                            "text": piece,
                            "source": source,
                            "page": page,
                            "chunk_index": chunk_idx,
                        })
                        chunk_idx += 1
                current = ""

    if current.strip():
        chunks.append({
            "text": current.strip(),
            "source": source,
            "page": page,
            "chunk_index": chunk_idx,
        })

    return chunks


# ── Public API ─────────────────────────────────────────────────────────────────

def process_pdf(pdf_path: str) -> List[Dict]:
    """
    Full pipeline: PDF file → list of chunk dicts ready for vector store.

    Each chunk: {text, source, page, chunk_index}
    """
    if not PDF_AVAILABLE:
        raise RuntimeError(
            "pdfplumber is not installed. Run: pip install pdfplumber"
        )

    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    source_name = path.stem          # filename without extension
    pages = _extract_pages(pdf_path)

    if not pages:
        logger.warning("No text extracted from %s", pdf_path)
        return []

    all_chunks: List[Dict] = []
    for page_data in pages:
        page_chunks = _chunk_text(
            text=page_data["text"],
            source=source_name,
            page=page_data["page"],
            start_index=len(all_chunks),
        )
        all_chunks.extend(page_chunks)

    logger.info(
        "Processed '%s': %d pages → %d chunks",
        path.name, len(pages), len(all_chunks),
    )
    return all_chunks
