from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.db import get_pool
from core.deps import get_optional_user_id

router = APIRouter(prefix="/api/alumni-directory")


@router.get("")
async def list_directory(
    search: Optional[str] = None,
    industry: Optional[str] = None,
    page: int = Query(1),
    pageSize: int = Query(12),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    page = max(1, page)
    page_size = min(50, max(1, pageSize))

    conditions = ["status = 'active'"]
    params: list = []
    if user_id:
        params.append(user_id)
        conditions.append(f"id != ${len(params)}")
    if search and search.strip():
        params.append(f"%{search.strip()}%")
        conditions.append(f"(full_name ILIKE ${len(params)} OR employer ILIKE ${len(params)} OR designation ILIKE ${len(params)})")
    if industry and industry.strip() and industry != "all":
        params.append(industry.strip())
        conditions.append(f"industry = ${len(params)}")

    where = f"WHERE {' AND '.join(conditions)} AND (ps.show_in_directory IS NULL OR ps.show_in_directory = true)"

    pool = get_pool()
    total = await pool.fetchval(
        f"SELECT count(*)::int FROM users LEFT JOIN privacy_settings ps ON ps.user_id = users.id {where}", *params
    )

    params2 = [*params, page_size, (page - 1) * page_size]
    rows = await pool.fetch(
        f"""SELECT users.id, full_name AS "fullName", employer, designation, industry, joining_year AS "joiningYear",
                   profile_photo_path AS "profilePhotoPath", linkedin_url AS "linkedinUrl"
            FROM users LEFT JOIN privacy_settings ps ON ps.user_id = users.id
            {where}
            ORDER BY full_name ASC
            LIMIT ${len(params2) - 1} OFFSET ${len(params2)}""",
        *params2,
    )

    industries = await pool.fetch("SELECT DISTINCT industry FROM users WHERE status = 'active' ORDER BY industry ASC")

    return {
        "alumni": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "industries": [r["industry"] for r in industries],
    }
