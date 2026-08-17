from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.db.database import get_db
from app.models.base import Employee, Attendance
from app.core.security import get_current_user, get_current_admin

router = APIRouter()


def _employee_today(employee: Employee) -> date:
    """The calendar date in the employee's OWN office, not the server's —
    check-in/out near midnight must file against the employee's local day,
    not wherever the backend process happens to be running."""
    try:
        tz = ZoneInfo(employee.timezone or "Asia/Kolkata")
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("Asia/Kolkata")
    return datetime.now(tz).date()

class CheckInRequest(BaseModel):
    location: Optional[str] = None
    notes: Optional[str] = None

class AttendanceUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

def attendance_to_dict(att):
    hours = 0
    if att.check_in and att.check_out:
        ci = att.check_in if att.check_in.tzinfo else att.check_in.replace(tzinfo=timezone.utc)
        co = att.check_out if att.check_out.tzinfo else att.check_out.replace(tzinfo=timezone.utc)
        diff = co - ci
        hours = round(diff.total_seconds() / 3600, 2)
    return {
        "id": att.id,
        "employee_id": att.employee_id,
        "employee_name": f"{att.employee.first_name} {att.employee.last_name}" if att.employee else None,
        "employee_timezone": (att.employee.timezone if att.employee else None) or "Asia/Kolkata",
        "date": str(att.date),
        "check_in": att.check_in.isoformat() if att.check_in else None,
        "check_out": att.check_out.isoformat() if att.check_out else None,
        "work_hours": att.work_hours or hours,
        "status": att.status,
        "notes": att.notes,
        "location": att.location,
    }

@router.post("/checkin")
def check_in(
    request: CheckInRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    today = _employee_today(current_user)
    existing = db.query(Attendance).filter(
        Attendance.employee_id == current_user.id,
        Attendance.date == today
    ).first()
    if existing and existing.check_in:
        raise HTTPException(status_code=400, detail="Already checked in today")
    
    if existing:
        existing.check_in = datetime.now(timezone.utc)
        existing.location = request.location
        att = existing
    else:
        att = Attendance(
            employee_id=current_user.id,
            date=today,
            check_in=datetime.now(timezone.utc),
            status="present",
            location=request.location,
            notes=request.notes
        )
        db.add(att)
    db.commit()
    db.refresh(att)
    return {"message": "Checked in successfully", "check_in": att.check_in.isoformat()}

@router.post("/checkout")
def check_out(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    try:
        today = _employee_today(current_user)
        att = db.query(Attendance).filter(
            Attendance.employee_id == current_user.id,
            Attendance.date == today
        ).first()
        if not att or not att.check_in:
            raise HTTPException(status_code=400, detail="Not checked in today")
        if att.check_out:
            raise HTTPException(status_code=400, detail="Already checked out today")

        now = datetime.now(timezone.utc)
        att.check_out = now

        check_in = att.check_in
        if check_in.tzinfo is None:
            check_in = check_in.replace(tzinfo=timezone.utc)

        diff = now - check_in
        att.work_hours = round(diff.total_seconds() / 3600, 2)
        db.commit()
        db.refresh(att)
        return {
            "message": "Checked out successfully",
            "check_out": att.check_out.isoformat(),
            "work_hours": att.work_hours
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Checkout error: {type(e).__name__}: {e}")

@router.get("/today")
def get_today_status(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    today = date.today()
    att = db.query(Attendance).filter(
        Attendance.employee_id == current_user.id,
        Attendance.date == today
    ).first()
    if not att:
        return {"status": "not_checked_in", "date": str(today)}
    return attendance_to_dict(att)

@router.get("/my")
def get_my_attendance(
    month: Optional[int] = None,
    year: Optional[int] = None,
    full_year: bool = False,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    from calendar import monthrange
    today = date.today()
    y = year or today.year
    if full_year:
        start = date(y, 1, 1)
        end = date(y, 12, 31)
    else:
        m = month or today.month
        start = date(y, m, 1)
        end = date(y, m, monthrange(y, m)[1])
    
    records = db.query(Attendance).filter(
        Attendance.employee_id == current_user.id,
        Attendance.date >= start,
        Attendance.date <= end
    ).order_by(Attendance.date.desc()).all()
    
    present = sum(1 for r in records if r.status == "present")
    absent = sum(1 for r in records if r.status == "absent")
    total_hours = sum(r.work_hours or 0 for r in records)
    
    return {
        "records": [attendance_to_dict(r) for r in records],
        "summary": {
            "present": present,
            "absent": absent,
            "total_hours": round(total_hours, 2),
            "avg_hours": round(total_hours / max(present, 1), 2)
        }
    }

@router.get("/all")
def get_all_attendance(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    employee_id: Optional[int] = None,
    department_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    query = db.query(Attendance)
    if date_from:
        query = query.filter(Attendance.date >= date_from)
    if date_to:
        query = query.filter(Attendance.date <= date_to)
    if employee_id:
        query = query.filter(Attendance.employee_id == employee_id)
    
    total = query.count()
    records = query.order_by(Attendance.date.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "records": [attendance_to_dict(r) for r in records]
    }

@router.get("/presence")
def get_today_presence(
    target_date: Optional[date] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    """Today's check-in presence for any department. Accessible to all roles."""
    check_date = target_date or date.today()

    query = db.query(Attendance).filter(Attendance.date == check_date)

    if department_id:
        query = (
            query.join(Employee, Attendance.employee_id == Employee.id)
                 .filter(Employee.department_id == department_id)
        )

    records = query.all()
    return [attendance_to_dict(r) for r in records]


@router.put("/{attendance_id}")
def update_attendance(
    attendance_id: int,
    data: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    att = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(att, key, value)
    if att.check_in and att.check_out:
        diff = att.check_out - att.check_in
        att.work_hours = round(diff.total_seconds() / 3600, 2)
    db.commit()
    db.refresh(att)
    return attendance_to_dict(att)
