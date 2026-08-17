"""
ChromaDB 1.x persistent vector store wrapper.

Collection: "hr_policies"
Embedding model: all-MiniLM-L6-v2 (ONNX, cached at first use, ~79 MB)
Similarity: cosine
"""
import uuid
import logging
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger(__name__)

CHROMA_PATH = Path(__file__).parent.parent / "data" / "chroma_db"
COLLECTION_NAME = "hr_policies"

try:
    import chromadb
    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
    _CHROMA_OK = True
except ImportError:
    _CHROMA_OK = False
    logger.error("chromadb not installed — run: pip install chromadb")


class VectorStore:
    """Thin wrapper around a ChromaDB persistent collection."""

    def __init__(self):
        self._col = None

        if not _CHROMA_OK:
            return

        try:
            CHROMA_PATH.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=str(CHROMA_PATH))
            ef = DefaultEmbeddingFunction()
            self._col = client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=ef,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(
                "VectorStore ready — collection '%s' has %d chunks",
                COLLECTION_NAME, self._col.count(),
            )
        except Exception as exc:
            logger.error("VectorStore init error: %s", exc)

    # ── Accessors ──────────────────────────────────────────────────────────────

    @property
    def is_ready(self) -> bool:
        return self._col is not None

    def count(self) -> int:
        return self._col.count() if self._col else 0

    def get_sources(self) -> List[str]:
        if not self._col or self._col.count() == 0:
            return []
        result = self._col.get(include=["metadatas"])
        seen = set()
        for m in result.get("metadatas") or []:
            if m and m.get("source"):
                seen.add(m["source"])
        return sorted(seen)

    def source_exists(self, source: str) -> bool:
        return source in self.get_sources()

    # ── Writes ─────────────────────────────────────────────────────────────────

    def add_chunks(self, chunks: List[Dict]):
        """
        Each chunk must have: {text, source}
        Optional: {page, chunk_index}
        """
        if not self._col:
            raise RuntimeError("VectorStore not initialized")
        if not chunks:
            return

        documents = [c["text"] for c in chunks]
        metadatas = [
            {
                "source": c.get("source", "unknown"),
                "page":   int(c.get("page", 0)),
                "chunk_index": int(c.get("chunk_index", i)),
            }
            for i, c in enumerate(chunks)
        ]
        ids = [str(uuid.uuid4()) for _ in chunks]

        # ChromaDB has a default batch limit — chunk in batches of 500
        batch = 500
        for start in range(0, len(documents), batch):
            self._col.add(
                documents=documents[start: start + batch],
                metadatas=metadatas[start: start + batch],
                ids=ids[start: start + batch],
            )

        logger.info("Added %d chunks (source: %s)", len(chunks),
                    chunks[0].get("source", "?") if chunks else "?")

    def delete_source(self, source: str):
        if not self._col:
            return
        self._col.delete(where={"source": source})
        logger.info("Deleted all chunks with source='%s'", source)

    # ── Reads ──────────────────────────────────────────────────────────────────

    def query(self, query_text: str, n_results: int = 6) -> List[Dict]:
        """
        Semantic similarity search.
        Returns list of {text, source, page, score} dicts, best first.
        """
        if not self._col or self._col.count() == 0:
            return []

        k = min(n_results, self._col.count())
        results = self._col.query(
            query_texts=[query_text],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        hits = []
        docs      = (results.get("documents")  or [[]])[0]
        metas     = (results.get("metadatas")  or [[]])[0]
        distances = (results.get("distances")  or [[]])[0]

        for doc, meta, dist in zip(docs, metas, distances):
            hits.append({
                "text":   doc,
                "source": (meta or {}).get("source", "Unknown"),
                "page":   (meta or {}).get("page", 0),
                "score":  round(1.0 - dist, 4),   # cosine similarity
            })

        return hits


# Module-level singleton
vector_store = VectorStore()
