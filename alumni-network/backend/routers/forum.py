from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core.db import get_pool
from core.deps import get_optional_user_id, require_alumni_user_id
from core.notifications import create_notification

router = APIRouter(prefix="/api/forum")


@router.get("/posts")
async def list_posts(category: Optional[str] = None, search: Optional[str] = None, user_id: Optional[int] = Depends(get_optional_user_id)):
    conditions = []
    params: list = []
    if category and category != "all":
        params.append(category)
        conditions.append(f"p.category = ${len(params)}")
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"p.title ILIKE ${len(params)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    params.append(user_id)
    viewer_param = len(params)

    rows = await get_pool().fetch(
        f"""SELECT p.*, u.full_name AS author_name, u.profile_photo_path AS author_photo,
                   COALESCE(l.like_count, 0)::int AS like_count,
                   COALESCE(r.reply_count, 0)::int AS reply_count,
                   EXISTS(SELECT 1 FROM forum_likes WHERE post_id = p.id AND user_id = ${viewer_param}) AS viewer_liked
            FROM forum_posts p
            JOIN users u ON u.id = p.author_id
            LEFT JOIN (SELECT post_id, COUNT(*) AS like_count FROM forum_likes GROUP BY post_id) l ON l.post_id = p.id
            LEFT JOIN (SELECT post_id, COUNT(*) AS reply_count FROM forum_replies GROUP BY post_id) r ON r.post_id = p.id
            {where}
            ORDER BY p.pinned DESC, p.created_at DESC""",
        *params,
    )
    return {"posts": [dict(r) for r in rows]}


@router.post("/posts", status_code=201)
async def create_post(request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    category = str(body.get("category") or "").strip()
    title = str(body.get("title") or "").strip()
    content = str(body.get("content") or "").strip()
    if not category or not title or not content:
        raise HTTPException(status_code=400, detail="Category, title, and content are required.")

    row = await get_pool().fetchrow(
        "INSERT INTO forum_posts (author_id, category, title, content) VALUES ($1, $2, $3, $4) RETURNING *",
        user_id, category, title, content,
    )
    return {"post": dict(row)}


@router.get("/posts/{post_id}")
async def get_post(post_id: int, user_id: Optional[int] = Depends(get_optional_user_id)):
    pool = get_pool()
    post = await pool.fetchrow(
        """SELECT p.*, u.full_name AS author_name, u.profile_photo_path AS author_photo,
                  COALESCE(l.like_count, 0)::int AS like_count,
                  EXISTS(SELECT 1 FROM forum_likes WHERE post_id = p.id AND user_id = $2) AS viewer_liked
           FROM forum_posts p
           JOIN users u ON u.id = p.author_id
           LEFT JOIN (SELECT post_id, COUNT(*) AS like_count FROM forum_likes GROUP BY post_id) l ON l.post_id = p.id
           WHERE p.id = $1""",
        post_id, user_id,
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    replies = await pool.fetch(
        """SELECT r.*, u.full_name AS author_name, u.profile_photo_path AS author_photo
           FROM forum_replies r JOIN users u ON u.id = r.author_id
           WHERE r.post_id = $1 ORDER BY r.created_at ASC""",
        post_id,
    )
    return {"post": dict(post), "replies": [dict(r) for r in replies]}


@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: int, user_id: int = Depends(require_alumni_user_id)):
    pool = get_pool()
    post = await pool.fetchrow("SELECT id FROM forum_posts WHERE id = $1", post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    existing = await pool.fetchrow("SELECT id FROM forum_likes WHERE post_id = $1 AND user_id = $2", post_id, user_id)
    if existing:
        await pool.execute("DELETE FROM forum_likes WHERE id = $1", existing["id"])
        liked = False
    else:
        await pool.execute("INSERT INTO forum_likes (post_id, user_id) VALUES ($1, $2)", post_id, user_id)
        liked = True

    like_count = await pool.fetchval("SELECT count(*)::int FROM forum_likes WHERE post_id = $1", post_id)
    return {"liked": liked, "likeCount": like_count}


@router.post("/posts/{post_id}/replies", status_code=201)
async def create_reply(post_id: int, request: Request, user_id: int = Depends(require_alumni_user_id)):
    body = await request.json()
    text = str(body.get("body") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Reply cannot be empty.")

    pool = get_pool()
    post = await pool.fetchrow("SELECT id, author_id, title FROM forum_posts WHERE id = $1", post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    inserted = await pool.fetchrow(
        "INSERT INTO forum_replies (post_id, author_id, body) VALUES ($1, $2, $3) RETURNING *", post_id, user_id, text
    )

    if post["author_id"] != user_id:
        replier = await pool.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
        replier_name = replier["full_name"] if replier else "Someone"
        try:
            await create_notification(
                post["author_id"], "forum", "New Reply",
                f'{replier_name} replied to your post "{post["title"]}".', f"/portal/forum/{post_id}",
            )
        except Exception:
            pass

    author = await pool.fetchrow("SELECT full_name, profile_photo_path FROM users WHERE id = $1", user_id)
    reply = dict(inserted)
    reply["author_name"] = author["full_name"] if author else None
    reply["author_photo"] = author["profile_photo_path"] if author else None
    return {"reply": reply}


@router.get("/stats")
async def forum_stats():
    pool = get_pool()
    posts = await pool.fetchval("SELECT count(*)::int FROM forum_posts")
    members = await pool.fetchval("SELECT count(*)::int FROM users WHERE status = 'active'")
    replies = await pool.fetchval("SELECT count(*)::int FROM forum_replies")
    return {"posts": posts, "members": members, "replies": replies}
