import httpx

from core.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class AIError(Exception):
    pass


async def generate_reply(system_prompt: str, history: list[dict]) -> str:
    """history: list of {"role": "user"|"model", "text": str}, oldest first."""
    if not settings.gemini_api_key:
        raise AIError("The AI assistant is not configured yet.")

    contents = [{"role": h["role"], "parts": [{"text": h["text"]}]} for h in history]

    url = GEMINI_URL.format(model=settings.gemini_model)
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            url,
            params={"key": settings.gemini_api_key},
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": contents,
                "generationConfig": {"maxOutputTokens": 800},
            },
        )

    if res.status_code == 429:
        raise AIError("Buddy has hit its daily usage limit. Please try again tomorrow, or ask an admin to upgrade the AI plan.")
    if res.status_code != 200:
        raise AIError(f"AI request failed ({res.status_code}).")

    data = res.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise AIError("The AI assistant did not return a response.")

    parts = candidates[0].get("content", {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise AIError("The AI assistant did not return a response.")
    return text
