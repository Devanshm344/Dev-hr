import sys
sys.path.insert(0, ".")
from app.services.vector_store import vector_store

print("Total chunks:", vector_store.count())
print("Sources:", vector_store.get_sources())

hits = vector_store.query("types of misconduct disciplinary action", n_results=6)
print("\n--- Query results ---")
for h in hits:
    score = h.get("score", "N/A")
    text = h.get("text", "")[:200]
    src = h.get("source", "")
    print(f"Source: {src} | Score: {score}")
    print(f"Text preview: {text}")
    print()

# Also test with lower threshold - check raw scores
print("\n--- Raw ChromaDB query ---")
raw = vector_store._col.query(
    query_texts=["misconduct"],
    n_results=5,
    include=["documents", "metadatas", "distances"]
)
for i, doc in enumerate(raw["documents"][0]):
    dist = raw["distances"][0][i]
    meta = raw["metadatas"][0][i]
    print(f"Distance: {dist:.4f} | Score(1-dist): {1-dist:.4f} | Source: {meta.get('source','?')}")
    print(f"Text: {doc[:120]}")
    print()
