"""
Re-index all JSON policies into ChromaDB and test a query.
Run from backend/: python reindex.py
"""
import sys, json, uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

CHROMA_PATH = Path(__file__).parent / "app" / "data" / "chroma_db"
POLICIES_DIR = Path(__file__).parent / "app" / "data" / "policies"
COLLECTION_NAME = "hr_policies"

print(f"ChromaDB path: {CHROMA_PATH}")
CHROMA_PATH.mkdir(parents=True, exist_ok=True)

client = chromadb.PersistentClient(path=str(CHROMA_PATH))
ef = DefaultEmbeddingFunction()

# Delete existing collection if present to start fresh
try:
    client.delete_collection(COLLECTION_NAME)
    print("Deleted old collection")
except:
    pass

col = client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=ef,
    metadata={"hnsw:space": "cosine"},
)
print(f"Collection created: {COLLECTION_NAME}")

# Index all JSON policies
total = 0
for path in sorted(POLICIES_DIR.glob("*.json")):
    doc = json.loads(path.read_text(encoding="utf-8"))
    title = doc.get("title", path.stem)
    source = path.stem
    chunks = []
    for section in doc.get("sections", []):
        sec_title = section.get("title", "General")
        body = "\n\n".join(p for p in section.get("paragraphs", []) if p.strip())
        if body:
            chunks.append({
                "text": f"{title} — {sec_title}\n\n{body}",
                "source": source,
            })
    if chunks:
        col.add(
            documents=[c["text"] for c in chunks],
            metadatas=[{"source": c["source"], "page": 0, "chunk_index": i} for i, c in enumerate(chunks)],
            ids=[str(uuid.uuid4()) for _ in chunks],
        )
        print(f"  Indexed '{source}': {len(chunks)} chunks")
        total += len(chunks)

print(f"\nTotal chunks indexed: {total}")
print(f"Collection count: {col.count()}")

# Verify ChromaDB files on disk
print(f"\nFiles in {CHROMA_PATH}:")
for f in CHROMA_PATH.rglob("*"):
    print(f"  {f.relative_to(CHROMA_PATH)} ({f.stat().st_size if f.is_file() else 'dir'})")

# Test query
print("\n--- Test query: misconduct disciplinary ---")
results = col.query(
    query_texts=["types of misconduct that can lead to disciplinary action"],
    n_results=3,
    include=["documents", "metadatas", "distances"],
)
for i, doc in enumerate(results["documents"][0]):
    dist = results["distances"][0][i]
    score = round(1.0 - dist, 4)
    src = results["metadatas"][0][i].get("source", "?")
    print(f"\nRank {i+1} | Source: {src} | Score: {score}")
    print(f"Text: {doc[:300]}")
