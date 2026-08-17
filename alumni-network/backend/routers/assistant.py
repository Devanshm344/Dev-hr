from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core.ai import AIError, generate_reply
from core.db import get_pool
from core.deps import get_session, require_alumni_user_id, require_role
from routers.messages import _are_connected

router = APIRouter(prefix="/api/assistant")

admin_only = Depends(require_role("admin"))

MAX_HISTORY_MESSAGES = 12


async def _alumni_context(user_id: int) -> str:
    pool = get_pool()
    profile = await pool.fetchrow("SELECT full_name, employer, designation, industry, status FROM users WHERE id = $1", user_id)
    active_benefit_count = await pool.fetchval("SELECT count(*)::int FROM benefits WHERE active = true")
    benefits = await pool.fetch("SELECT title, category, description FROM benefits WHERE active = true ORDER BY category LIMIT 20")
    upcoming_event_count = await pool.fetchval("SELECT count(*)::int FROM events WHERE event_date >= now()")
    events = await pool.fetch("SELECT title, event_date, location FROM events WHERE event_date >= now() ORDER BY event_date LIMIT 5")
    faq_count = await pool.fetchval("SELECT count(*)::int FROM faqs WHERE published = true")
    faqs = await pool.fetch("SELECT question, answer FROM faqs WHERE published = true ORDER BY display_order LIMIT 10")
    own_request_count = await pool.fetchval("SELECT count(*)::int FROM service_requests WHERE user_id = $1", user_id)
    requests = await pool.fetch("SELECT benefit_title, created_at FROM service_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10", user_id)

    lines = [f"The alumnus you're helping: {profile['full_name']}, {profile['designation'] or 'N/A'} at {profile['employer'] or 'N/A'}, industry: {profile['industry'] or 'N/A'}, account status: {profile['status']}."]
    lines.append(f"\nTotal active benefits available on the portal: {active_benefit_count}. (If asked how many benefits exist, use this exact number — the list below may be truncated for brevity.)")
    lines.append("\nActive benefits available on the portal:")
    lines += [f"- {b['title']} ({b['category']}): {b['description']}" for b in benefits] or ["- none currently active"]
    lines.append(f"\nTotal upcoming events: {upcoming_event_count}. (Use this exact number if asked how many events are coming up — the list below may be truncated for brevity.)")
    lines.append("\nUpcoming events:")
    lines += [f"- {e['title']} on {e['event_date']:%Y-%m-%d} at {e['location']}" for e in events] or ["- no upcoming events"]
    lines.append(f"\nTotal published FAQs: {faq_count}. (Use this exact number if asked how many FAQs exist — the list below may be truncated for brevity.)")
    lines.append("\nFAQs:")
    lines += [f"- Q: {f['question']} A: {f['answer']}" for f in faqs] or ["- none"]
    lines.append("\nBenefit resources are available instantly to any logged-in alumnus, no approval needed — they can grab them directly from the Benefits page.")
    lines.append(f"\nThis alumnus has {own_request_count} total Service Request conversation(s) (from the Service Requests / chat-with-HR feature). Use this exact number if asked how many they've made — the list below may be truncated for brevity.")
    lines += [f"- {r['benefit_title']} (started {r['created_at']:%Y-%m-%d})" for r in requests] or ["- none started yet"]
    return "\n".join(lines)


async def _staff_context(role: str) -> str:
    pool = get_pool()
    pending_reg = await pool.fetchval("SELECT count(*)::int FROM users WHERE status = 'pending'")
    active_alumni = await pool.fetchval("SELECT count(*)::int FROM users WHERE status = 'active'")
    total_requests = await pool.fetchval("SELECT count(*)::int FROM service_requests")
    total_benefit_count = await pool.fetchval("SELECT count(*)::int FROM benefits")
    active_benefit_count = await pool.fetchval("SELECT count(*)::int FROM benefits WHERE active = true")
    benefits = await pool.fetch("SELECT title, category, active FROM benefits ORDER BY category LIMIT 20")
    announcement_count = await pool.fetchval("SELECT count(*)::int FROM announcements")
    announcements = await pool.fetch("SELECT title, priority, published FROM announcements ORDER BY created_at DESC LIMIT 5")
    monthly_growth = await pool.fetch("""
        WITH months AS (
          SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
          FROM generate_series(5, 0, -1) AS n
        )
        SELECT to_char(month_start, 'Mon YYYY') AS month,
               (SELECT count(*)::int FROM users u WHERE date_trunc('month', u.created_at) = months.month_start) AS new_registrations
        FROM months ORDER BY month_start
    """)
    category_popularity = await pool.fetch("""
        SELECT b.category, count(*)::int AS request_count
        FROM service_requests sr JOIN benefits b ON b.id = sr.benefit_id
        GROUP BY b.category ORDER BY request_count DESC
    """)
    top_benefits = await pool.fetch("""
        SELECT benefit_title, count(*)::int AS request_count
        FROM service_requests GROUP BY benefit_title ORDER BY request_count DESC LIMIT 5
    """)

    lines = [f"You're helping a {role.upper()} staff member manage the TechDemocracy Alumni Network."]
    lines.append(f"\nPending registrations awaiting review: {pending_reg}. Active alumni: {active_alumni}.")
    lines.append("\nNew alumni registrations by month (last 6 months, oldest to newest):")
    lines += [f"- {m['month']}: {m['new_registrations']} new registrations" for m in monthly_growth]
    lines.append("\nBenefit category popularity, ranked by number of service requests (most to least popular):")
    lines += [f"- {c['category']}: {c['request_count']} requests" for c in category_popularity] or ["- no service requests yet"]
    lines.append("\nTop 5 individual benefits by request volume:")
    lines += [f"- {b['benefit_title']}: {b['request_count']} requests" for b in top_benefits] or ["- none"]
    lines.append(f"\nTotal Service Request conversations (alumni chatting with HR about a benefit): {total_requests}. There's no approve/reject workflow anymore — benefit resources are open to all alumni instantly, and Service Requests is just a chat channel.")
    lines.append(f"\nTotal benefits in the system: {total_benefit_count} ({active_benefit_count} active). (If asked how many benefits exist, use these exact numbers — the list below may be truncated for brevity.)")
    lines.append("\nBenefits:")
    lines += [f"- {b['title']} ({b['category']}) — {'active' if b['active'] else 'inactive'}" for b in benefits] or ["- none"]
    lines.append(f"\nTotal announcements in the system: {announcement_count}. (Use this exact number if asked how many announcements exist — the list below may be truncated for brevity.)")
    lines.append("\nRecent announcements:")
    lines += [f"- {a['title']} (priority: {a['priority']}, {'published' if a['published'] else 'draft'})" for a in announcements] or ["- none"]
    return "\n".join(lines)


@router.post("/chat")
async def chat(request: Request, session=Depends(get_session)):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    body = await request.json()
    message = str(body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")
    history = body.get("history") or []

    formatting_rule = "Reply in plain text only: no markdown, no asterisks, no bullet symbols, no headers. Use line breaks and plain dashes for lists if needed."
    accuracy_rule = (
        "For any question asking 'how many' of something, always use the explicit total count given in the context "
        "(e.g. 'Total active benefits available') rather than counting the items in a list below it, since those "
        "lists are sometimes truncated for brevity and undercount the real total. Never guess or estimate a number "
        "that isn't stated in the context — if the exact figure isn't given, say you don't have that number."
    )

    role = session["role"]
    if role == "alumni":
        context = await _alumni_context(session["userId"])
        base_prompt = (
            "You are Buddy, the AI assistant embedded in the TechDemocracy Alumni Network portal, helping an alumnus. "
            "If asked your name, say you're Buddy. Answer using the context below. Be concise and friendly. If asked something outside this context "
            "(not about the portal, benefits, events, or their own requests), say you can only help with portal-related questions. "
            f"{accuracy_rule} {formatting_rule}"
        )
    elif role in ("hr", "admin"):
        context = await _staff_context(role)
        base_prompt = (
            "You are Buddy, the AI assistant embedded in the TechDemocracy Alumni Network staff portal, helping HR/Admin staff. "
            "If asked your name, say you're Buddy. Answer using the context below: summarize data, draft text, or explain platform state. Be concise. "
            "If asked something outside this context, say you can only help with platform-related questions. "
            f"{accuracy_rule} {formatting_rule}"
        )
    else:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    system_prompt = f"{base_prompt}\n\n--- Context ---\n{context}"

    gemini_history = []
    for h in history[-MAX_HISTORY_MESSAGES:]:
        role_name = "model" if h.get("role") == "assistant" else "user"
        text = str(h.get("text") or "").strip()
        if text:
            gemini_history.append({"role": role_name, "text": text})
    gemini_history.append({"role": "user", "text": message})

    try:
        reply = await generate_reply(system_prompt, gemini_history)
    except AIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"reply": reply}


@router.post("/polish-story")
async def polish_story(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    draft = str(body.get("draft") or "").strip()
    if not draft:
        raise HTTPException(status_code=400, detail="Write a draft first.")

    system_prompt = (
        "You help alumni polish their testimonial submissions for the TechDemocracy Alumni Network's "
        "'Share Your Story' feature. Rewrite the draft below to be clear, warm, and concise (2-4 sentences), "
        "keeping the author's own voice and facts intact — do not invent details, achievements, or names that "
        "aren't in the draft. Reply with only the rewritten story text, no preamble, no quotation marks, no markdown."
    )
    try:
        polished = await generate_reply(system_prompt, [{"role": "user", "text": draft}])
    except AIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"polished": polished}


@router.post("/dm-summarize")
async def dm_summarize(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    try:
        with_user_id = int(body.get("withUserId"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="withUserId is required.")

    if not await _are_connected(user_id, with_user_id):
        raise HTTPException(status_code=403, detail="You can only summarize conversations with accepted connections.")

    pool = get_pool()
    viewer = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
    other = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", with_user_id)
    rows = await pool.fetch(
        """SELECT sender_id, body, attachment_filename, deleted_at FROM messages
           WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
           ORDER BY created_at ASC""",
        user_id, with_user_id,
    )

    lines = []
    for r in rows:
        if r["deleted_at"]:
            continue
        speaker = viewer["full_name"] if r["sender_id"] == user_id else other["full_name"]
        piece = r["body"] or ""
        if r["attachment_filename"]:
            piece = f"{piece} [attached file: {r['attachment_filename']}]".strip()
        if piece:
            lines.append(f"{speaker}: {piece}")

    if not lines:
        raise HTTPException(status_code=400, detail="There's nothing in this conversation yet.")

    system_prompt = (
        "Summarize this private direct-message conversation between two members of the TechDemocracy Alumni "
        "Network in 2-3 sentences. Capture the key points and any open questions or action items. "
        "Plain text only, no markdown, no preamble."
    )
    try:
        summary = await generate_reply(system_prompt, [{"role": "user", "text": "\n".join(lines)}])
    except AIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"summary": summary}


@router.post("/dm-suggest-replies")
async def dm_suggest_replies(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    try:
        with_user_id = int(body.get("withUserId"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="withUserId is required.")

    if not await _are_connected(user_id, with_user_id):
        raise HTTPException(status_code=403, detail="You can only get suggestions for conversations with accepted connections.")

    pool = get_pool()
    other = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", with_user_id)
    rows = await pool.fetch(
        """SELECT sender_id, body, attachment_filename, deleted_at FROM messages
           WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
           ORDER BY created_at DESC LIMIT 10""",
        user_id, with_user_id,
    )
    rows = list(reversed(rows))

    if not rows or rows[-1]["sender_id"] == user_id:
        return {"suggestions": []}

    lines = []
    for r in rows:
        if r["deleted_at"]:
            continue
        speaker = "You" if r["sender_id"] == user_id else other["full_name"]
        piece = r["body"] or ""
        if r["attachment_filename"]:
            piece = f"{piece} [attached file: {r['attachment_filename']}]".strip()
        if piece:
            lines.append(f"{speaker}: {piece}")

    if not lines:
        return {"suggestions": []}

    system_prompt = (
        "You suggest quick reply options for a private direct-message chat on the TechDemocracy Alumni Network. "
        "Given the recent conversation below, suggest exactly 3 short, natural replies 'You' could send next. "
        "Reply with exactly 3 lines, one suggestion per line, no numbering, no bullets, no quotation marks, no markdown. "
        "Keep each under 12 words."
    )
    try:
        raw = await generate_reply(system_prompt, [{"role": "user", "text": "\n".join(lines)}])
    except AIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    suggestions = [line.strip("-•* ").strip() for line in raw.splitlines() if line.strip()][:3]
    return {"suggestions": suggestions}


@router.post("/triage-inquiry", dependencies=[admin_only])
async def triage_inquiry(request: Request):
    body = await request.json()
    message_id = body.get("messageId")
    if not message_id:
        raise HTTPException(status_code=400, detail="messageId is required.")

    row = await get_pool().fetchrow(
        "SELECT first_name, last_name, email, message FROM contact_messages WHERE id = $1", message_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Message not found.")

    system_prompt = (
        "You triage inbound contact-form messages for the TechDemocracy Alumni Network admin team. "
        "Given a message, respond with exactly three lines, plain text, no markdown:\n"
        "Category: <one or two words, e.g. Support, Partnership, Complaint, Media, Spam, General>\n"
        "Priority: <Low, Medium, or High>\n"
        "Suggested action: <one short sentence on how admin should respond>"
    )
    text = f"From: {row['first_name']} {row['last_name']} <{row['email']}>\nMessage: {row['message']}"

    try:
        suggestion = await generate_reply(system_prompt, [{"role": "user", "text": text}])
    except AIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"suggestion": suggestion}
