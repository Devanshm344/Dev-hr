from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.engagement.db import get_db
from app.engagement.deps import get_current_user
from app.engagement.repositories import time_repo
from app.engagement.schemas.requests import RemoveRowRequest, SaveCellRequest, WeekendEntryRequest
from app.engagement.services import time_service

router = APIRouter(tags=["time"])


@router.get("/time/week")
def week_grid(
    for_date: date = Query(default=None, alias="date"),
    create: bool = Query(default=True),
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    return {"data": time_service.get_week_grid(conn, user, for_date or date.today(), create=create)}


@router.put("/time/entries")
def save_cell(body: SaveCellRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    result = time_service.save_cell(
        conn,
        user,
        timesheet_id=body.timesheet_id,
        project_id=body.project_id,
        task_id=body.task_id,
        work_date=body.work_date,
        minutes=body.minutes,
        note=body.note,
    )
    return {"data": result, "message": "Saved"}


@router.post("/time/weekend-entries")
def log_weekend_entry(body: WeekendEntryRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    record = time_service.log_weekend_entry(
        conn, user, timesheet_id=body.timesheet_id, work_date=body.work_date, reason=body.reason,
    )
    return {
        "data": {
            "work_date": record["work_date"].isoformat(),
            "reason": record["reason"],
            "created_at": record["created_at"].isoformat(),
        },
        "message": "Reason logged — this day is now unlocked",
    }


@router.post("/time/rows/remove")
def remove_row(body: RemoveRowRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    removed = time_service.remove_row(
        conn, user, timesheet_id=body.timesheet_id, project_id=body.project_id, task_id=body.task_id
    )
    return {"data": {"removed_entries": removed}, "message": "Row removed"}


@router.post("/timesheets/{timesheet_id}/submit")
def submit_timesheet(timesheet_id: str, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    ts = time_service.submit(conn, user, timesheet_id)
    return {
        "data": {
            "id": ts["id"],
            "status": ts["status"],
            "submitted_at": ts["submitted_at"].isoformat(),
        },
        "message": "Timesheet submitted",
    }


@router.get("/timesheets/my")
def my_timesheets(
    granularity: Literal["day", "week", "month"] = Query(default="week"),
    count: int = Query(default=26, ge=1, le=60),
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    if granularity == "day":
        data = time_service.my_timesheets_days(conn, user, count)
    elif granularity == "month":
        data = time_service.my_timesheets_months(conn, user, count)
    else:
        data = time_repo.my_timesheets(conn, user["id"], limit=count)
    return {"data": data}


@router.get("/time/auditing")
def auditing(
    granularity: Literal["day", "week", "month"] = Query(default="week"),
    count: int = Query(default=8, ge=1, le=60),
    user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    if granularity == "day":
        data = time_service.auditing_overview_days(conn, user, count)
    elif granularity == "month":
        data = time_service.auditing_overview_months(conn, user, count)
    else:
        data = time_service.auditing_overview(conn, user, count)
    return {"data": data}
