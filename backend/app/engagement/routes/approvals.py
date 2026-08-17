from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.engagement.db import get_db
from app.engagement.deps import require_roles
from app.engagement.schemas.requests import ReviewDecisionRequest
from app.engagement.services import approvals_service

router = APIRouter(prefix="/approvals", tags=["approvals"])
manager_or_admin = require_roles("manager", "admin")


@router.get("/inbox")
def inbox(user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    return {"data": approvals_service.get_inbox(conn, user)}


@router.get("/team-auditing")
def team_auditing(
    granularity: Literal["day", "week", "month"] = Query(default="week"),
    count: int = Query(default=8, ge=1, le=60),
    user: dict = Depends(manager_or_admin),
    conn=Depends(get_db),
):
    return {"data": approvals_service.team_auditing(conn, user, granularity, count)}


@router.get("/{timesheet_id}")
def report_detail(timesheet_id: str, user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    return {"data": approvals_service.get_report_detail(conn, user, timesheet_id)}


@router.post("/{timesheet_id}/decision")
def decide(
    timesheet_id: str,
    body: ReviewDecisionRequest,
    user: dict = Depends(manager_or_admin),
    conn=Depends(get_db),
):
    result = approvals_service.decide(conn, user, timesheet_id, body.action, body.comment)
    message = "Timesheet approved" if body.action == "approve" else "Changes requested"
    return {"data": result, "message": message}
