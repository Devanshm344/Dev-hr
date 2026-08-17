from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from core.db import get_pool
from core.deps import require_alumni_user_id, require_role
from core.notifications import create_staff_notification

router = APIRouter(prefix="/api/feedback")

VALID_CATEGORIES = ["Portal Experience", "Benefits", "Events", "Networking", "HR Support", "Technical Issues", "General"]
VALID_ASPECTS = ["usability", "benefits", "events", "hr"]


@router.get("", dependencies=[Depends(require_role("hr", "admin"))])
async def list_feedback(category: Optional[str] = None):
    conditions = []
    params: list = []
    if category and category != "all":
        params.append(category)
        conditions.append(f"f.category = ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = await get_pool().fetch(
        f"""SELECT f.*, u.full_name AS submitter_name, u.email AS submitter_email
            FROM feedback f LEFT JOIN users u ON u.id = f.user_id
            {where} ORDER BY f.created_at DESC""",
        *params,
    )
    feedback = [
        {
            "id": r["id"],
            "category": r["category"],
            "rating": r["rating"],
            "message": r["message"],
            "aspectRatings": r["aspect_ratings"],
            "createdAt": r["created_at"],
            "submitterName": None if r["anonymous"] else r["submitter_name"],
            "submitterEmail": None if r["anonymous"] else r["submitter_email"],
            "anonymous": r["anonymous"],
        }
        for r in rows
    ]
    return {"feedback": feedback}


@router.post("", status_code=201)
async def submit_feedback(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    category = str(body.get("category") or "").strip()
    try:
        rating = int(body.get("rating"))
    except (TypeError, ValueError):
        rating = -1
    message = str(body.get("message") or "").strip()
    anonymous = body.get("anonymous") is True
    aspect_input = body.get("aspectRatings") if isinstance(body.get("aspectRatings"), dict) else {}

    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Please select a valid category.")
    if not (1 <= rating <= 5):
        raise HTTPException(status_code=400, detail="Please provide an overall rating.")
    if not message:
        raise HTTPException(status_code=400, detail="Please share your feedback.")

    aspect_ratings = {}
    for key in VALID_ASPECTS:
        try:
            value = int(aspect_input.get(key))
        except (TypeError, ValueError):
            continue
        if 1 <= value <= 5:
            aspect_ratings[key] = value

    row = await get_pool().fetchrow(
        """INSERT INTO feedback (user_id, category, rating, message, aspect_ratings, anonymous)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING *""",
        user_id, category, rating, message, aspect_ratings, anonymous,
    )

    try:
        await create_staff_notification(
            "hr", "feedback", "New Feedback Submitted", f"New {category} feedback submitted ({rating}/5 stars).", "/hr/feedback"
        )
    except Exception:
        pass

    return {"feedback": dict(row)}
