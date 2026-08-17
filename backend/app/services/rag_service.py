"""
RAG service — ChromaDB retrieval + Ollama generation.

Flow:
  1. User question → vector search (ChromaDB) → top-K policy chunks
  2. Chunks + question → Ollama local LLM → grounded answer

Anti-hallucination strategy:
  • Strict system prompt: answer ONLY from provided context
  • Temperature 0.05 (near-deterministic)
  • Explicit "not found" fallback when context score is low
  • Model never invents policy details
"""

import json
import os
import logging
from pathlib import Path
from typing import List, Dict, Optional

import httpx

from app.services.vector_store import vector_store
from app.core.config import settings

logger = logging.getLogger(__name__)

_POLICIES_DIR  = Path(__file__).parent.parent / "data" / "policies"

# ── Ollama defaults (from pydantic settings / .env) ───────────────────────────
_OLLAMA_URL    = settings.OLLAMA_BASE_URL
_OLLAMA_MODEL  = settings.OLLAMA_MODEL
_CONTEXT_HITS  = 10     # more chunks = covers multi-question queries better
_MIN_SCORE     = 0.18   # slightly lower threshold for broader coverage
_TIMEOUT       = 240.0  # seconds — allow longer multi-question responses

# ── System prompt (anti-hallucination) ────────────────────────────────────────
_SYSTEM = """\
You are an HR Policy Assistant for Cotelligent. Answer ONLY using the CONTEXT provided.

RULES:
1. Answer ONLY from the CONTEXT. Never use outside knowledge.
2. Start EVERY answer with the source in italics, e.g.: _Source: Disciplinary Policy_
3. If the user asks MULTIPLE questions, answer EVERY one with a numbered heading:
   **1. [Topic]**
   _Source: [Policy Name]_
   [answer]
   **2. [Topic]**
   _Source: [Policy Name]_
   [answer]
4. Be CONCISE — maximum 4-5 bullet points per answer. Summarize key points, do NOT dump entire lists.
5. If an answer is not in the CONTEXT, write: "Not covered in current HR policy documents."
6. You MUST answer ALL questions asked, no matter how many."""


# ── Helper: call Ollama /api/chat ──────────────────────────────────────────────

def _ollama_chat(messages: List[Dict], *, model: str, base_url: str) -> str:
    payload = {
        "model":   model,
        "messages": messages,
        "stream":   False,
        "options": {
            "temperature":  0.05,   # near-zero → stick to facts
            "top_p":        0.90,
            "top_k":        20,
            "num_predict":  3000,   # max response tokens for multi-question answers
            "repeat_penalty": 1.1,
        },
    }
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(f"{base_url}/api/chat", json=payload)
            r.raise_for_status()
            return r.json()["message"]["content"].strip()
    except httpx.ConnectError:
        return (
            "⚠️ Cannot reach Ollama. "
            "Please make sure Ollama is running (`ollama serve`) "
            f"and the model is downloaded (`ollama pull {model}`)."
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return (
                f"⚠️ Model '{model}' is not found in Ollama. "
                f"Run: `ollama pull {model}` and restart the server."
            )
        logger.error("Ollama HTTP error: %s", exc)
        return "⚠️ Ollama returned an error. Please check the server logs."
    except Exception as exc:
        logger.error("Ollama call failed: %s", exc)
        return "⚠️ An error occurred while contacting the AI model. Please try again."


# ── Check Ollama is reachable and model is available ──────────────────────────

def check_ollama(base_url: str, model: str) -> Dict:
    """Returns {ok, model, error} for health checks."""
    try:
        with httpx.Client(timeout=5) as client:
            r = client.get(f"{base_url}/api/tags")
            r.raise_for_status()
            names = [m["name"] for m in r.json().get("models", [])]
            # e.g. "llama3.2:3b" or "llama3.2" both valid
            found = any(n.startswith(model.split(":")[0]) for n in names)
            return {"ok": True, "model": model, "model_ready": found, "available_models": names}
    except Exception as exc:
        return {"ok": False, "model": model, "model_ready": False, "error": str(exc)}


# ── RAG Service ────────────────────────────────────────────────────────────────

class RAGService:

    def __init__(self):
        self._model    = settings.OLLAMA_MODEL
        self._base_url = settings.OLLAMA_BASE_URL
        self._seed_json_policies()

    # ── Seed bundled JSON policies ────────────────────────────────────────────

    def _seed_json_policies(self):
        if not vector_store.is_ready or not _POLICIES_DIR.exists():
            return
        for path in sorted(_POLICIES_DIR.glob("*.json")):
            source = path.stem
            if vector_store.source_exists(source):
                continue
            try:
                doc = json.loads(path.read_text(encoding="utf-8"))
                title = doc.get("title", source)
                chunks: List[Dict] = []
                for section in doc.get("sections", []):
                    sec_title = section.get("title", "General")
                    body = "\n\n".join(
                        p for p in section.get("paragraphs", []) if p.strip()
                    )
                    if body:
                        chunks.append({
                            "text":        f"{title} — {sec_title}\n\n{body}",
                            "source":      source,
                            "page":        0,
                            "chunk_index": len(chunks),
                        })
                if chunks:
                    vector_store.add_chunks(chunks)
                    logger.info("Seeded '%s' (%d chunks)", source, len(chunks))
            except Exception as exc:
                logger.error("Seed failed for %s: %s", path, exc)

    # ── Public: chat ──────────────────────────────────────────────────────────

    def chat(
        self,
        question: str,
        user_name: str,
        user_role: str,
        history: Optional[List[Dict]] = None,
    ) -> str:

        # 1. Retrieve relevant chunks
        hits = vector_store.query(question, n_results=_CONTEXT_HITS)

        # 2. Filter by minimum relevance score
        good_hits = [h for h in hits if h.get("score", 0) >= _MIN_SCORE]

        if good_hits:
            ctx_parts = []
            for h in good_hits:
                page_note = f", page {h['page']}" if h.get("page") else ""
                ctx_parts.append(
                    f"[{h['source']}{page_note}]\n{h['text']}"
                )
            context = "\n\n---\n\n".join(ctx_parts)
        else:
            # No relevant context found — tell the model explicitly
            context = (
                "NO RELEVANT POLICY FOUND. "
                "You must respond: 'This is not covered in the current HR policy "
                "documents. Please contact the HR team.'"
            )

        # 3. Build messages for Ollama
        system_with_ctx = (
            f"{_SYSTEM}\n\n"
            f"════ CONTEXT (use ONLY this) ════\n"
            f"{context}\n"
            f"════════════════════════════════\n\n"
            f"Employee: {user_name}  |  Role: {user_role}"
        )

        messages: List[Dict] = [{"role": "system", "content": system_with_ctx}]

        # Append recent conversation turns
        for msg in (history or [])[-6:]:
            role    = msg.get("role", "")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": question})

        # 4. Generate with Ollama
        return _ollama_chat(messages, model=self._model, base_url=self._base_url)

    # ── Accessors ─────────────────────────────────────────────────────────────

    def get_sources(self) -> List[str]:
        return vector_store.get_sources()

    @property
    def model(self) -> str:
        return self._model

    @property
    def base_url(self) -> str:
        return self._base_url


# Module-level singleton
rag_service = RAGService()
