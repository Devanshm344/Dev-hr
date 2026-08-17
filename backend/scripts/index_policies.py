#!/usr/bin/env python3
"""
Batch-index all PDF files in data/policy_pdfs/ into the ChromaDB vector store.

Usage (from the backend/ directory):
    python -m scripts.index_policies

Options:
    --reindex   Force re-index even if a source already exists in the vector store.
    --clear     Wipe the entire vector store before indexing.
    --status    Print current index status and exit.
"""
import sys
import argparse
from pathlib import Path

# Make sure the app package is importable from this script
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.services.vector_store import vector_store
from app.services.pdf_processor import process_pdf, PDF_AVAILABLE

PDF_DIR = Path(__file__).parent.parent / "app" / "data" / "policy_pdfs"


def print_status():
    print("\n── Vector Store Status ──────────────────")
    if not vector_store.is_ready:
        print("  ✗ Vector store is NOT ready (check chromadb installation)")
        return
    sources = vector_store.get_sources()
    print(f"  Total chunks : {vector_store.count()}")
    print(f"  Sources ({len(sources)}):")
    for s in sources:
        print(f"    • {s}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Index HR policy PDFs into ChromaDB")
    parser.add_argument("--reindex", action="store_true",
                        help="Re-index sources that are already in the vector store")
    parser.add_argument("--status", action="store_true",
                        help="Print current index status and exit")
    args = parser.parse_args()

    if args.status:
        print_status()
        return

    if not vector_store.is_ready:
        print("✗ Vector store is not ready. Is chromadb installed?")
        sys.exit(1)

    if not PDF_AVAILABLE:
        print("✗ pdfplumber is not installed. Run: pip install pdfplumber")
        sys.exit(1)

    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"\nNo PDFs found in: {PDF_DIR}")
        print("Drop your policy PDF files there and run this script again.")
        print_status()
        return

    print(f"\nFound {len(pdfs)} PDF(s) in {PDF_DIR}")
    total_new = 0

    for pdf_path in pdfs:
        source = pdf_path.stem
        exists = vector_store.source_exists(source)

        if exists and not args.reindex:
            print(f"  ↷  '{source}' already indexed (use --reindex to force)")
            continue

        print(f"\n  Processing: {pdf_path.name}")

        if exists:
            vector_store.delete_source(source)
            print(f"    Removed old index for '{source}'")

        try:
            chunks = process_pdf(str(pdf_path))
        except Exception as exc:
            print(f"    ✗ Error processing PDF: {exc}")
            continue

        if not chunks:
            print(f"    ✗ No text could be extracted. "
                  f"Make sure the PDF has selectable text (not a scanned image).")
            continue

        vector_store.add_chunks(chunks)
        pages = max((c.get("page", 0) for c in chunks), default=0)
        print(f"    ✓ Indexed '{source}': {pages} pages → {len(chunks)} chunks")
        total_new += len(chunks)

    print(f"\n── Done ─────────────────────────────────")
    if total_new:
        print(f"  Added {total_new} new chunks this run.")
    print_status()


if __name__ == "__main__":
    main()
