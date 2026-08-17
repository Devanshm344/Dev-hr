from fastapi import APIRouter, Depends, Query

from app.engagement.db import get_db
from app.engagement.deps import get_current_user, require_roles
from app.engagement.schemas.requests import SaveAllocationRequest
from app.engagement.services import allocations_service

router = APIRouter(prefix="/allocations", tags=["allocations"])
manager_or_admin = require_roles("manager", "admin")


@router.get("/matrix")
def matrix(
    project_id: str,
    weeks: int = Query(default=6, ge=1, le=12),
    user: dict = Depends(manager_or_admin),
    conn=Depends(get_db),
):
    return {"data": allocations_service.matrix(conn, user, project_id, weeks)}


@router.put("/cell")
def save_cell(body: SaveAllocationRequest, user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    result = allocations_service.save_cell(
        conn,
        user=user,
        project_id=body.project_id,
        user_id=body.user_id,
        week_start_date=body.week_start_date,
        minutes=body.minutes,
        note=body.note,
    )
    return {"data": result, "message": "Saved"}


@router.get("/my")
def my_allocations(
    weeks: int = Query(default=6, ge=1, le=12),
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    return {"data": allocations_service.my_allocations(conn, user, weeks)}


@router.get("/utilization")
def utilization(
    weeks: int = Query(default=6, ge=1, le=26),
    user_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    return {"data": allocations_service.utilization(conn, user, user_id, weeks)}
