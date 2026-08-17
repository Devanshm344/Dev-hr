from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import date, timedelta
import json
from app.db.database import get_db
from app.models.base import (
    Employee, Shift, EmployeeShiftMapping, ShiftSwapRequest, LeaveRequest,
    ShiftTypeEnum, ShiftSwapStatusEnum, StatusEnum
)
from app.core.security import get_current_user, get_current_admin
from app.services.notifications import create_notification

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ShiftCreate(BaseModel):
    name: str
    shift_type: ShiftTypeEnum = ShiftTypeEnum.general
    start_time: str   # "09:00"
    end_time: str     # "18:00"
    color: Optional[str] = "#6366f1"
    description: Optional[str] = None
    grace_period_minutes: Optional[int] = 15
    is_night_shift: Optional[bool] = False
    shift_margin: Optional[bool] = False
    core_working_hours: Optional[bool] = False
    weekend_basis: Optional[str] = "location"   # "location" | "shift"
    provide_shift_allowance: Optional[bool] = False
    eligibility_criteria: Optional[Dict[str, Any]] = None
    weekend_days: Optional[Dict[str, Any]] = None
    half_working_day_half_weekend: Optional[bool] = False
    define_statutory_weekends: Optional[bool] = False

class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    shift_type: Optional[ShiftTypeEnum] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    grace_period_minutes: Optional[int] = None
    is_night_shift: Optional[bool] = None
    is_active: Optional[bool] = None
    shift_margin: Optional[bool] = None
    core_working_hours: Optional[bool] = None
    weekend_basis: Optional[str] = None
    provide_shift_allowance: Optional[bool] = None
    eligibility_criteria: Optional[Dict[str, Any]] = None
    weekend_days: Optional[Dict[str, Any]] = None
    half_working_day_half_weekend: Optional[bool] = None
    define_statutory_weekends: Optional[bool] = None

class EmployeeShiftMappingCreate(BaseModel):
    employee_id: int
    shift_id: int
    effective_from: date
    effective_to: Optional[date] = None
    notes: Optional[str] = None

class EmployeeShiftMappingUpdate(BaseModel):
    effective_to: Optional[date] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class ShiftSwapCreate(BaseModel):
    requested_employee_id: int
    swap_date: date
    requester_shift_id: Optional[int] = None
    requested_shift_id: Optional[int] = None
    reason: Optional[str] = None

class ShiftSwapApproval(BaseModel):
    status: str  # approved / rejected


# ── Serializers ───────────────────────────────────────────────────────────────

def _parse_json_field(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None

def _prep_shift_payload(data: dict) -> dict:
    """Serialize dict-shaped fields to JSON text before writing to the Shift model."""
    prepped = dict(data)
    for field in ("eligibility_criteria", "weekend_days"):
        if field in prepped and prepped[field] is not None and not isinstance(prepped[field], str):
            prepped[field] = json.dumps(prepped[field])
    return prepped

def shift_to_dict(s):
    return {
        "id": s.id,
        "name": s.name,
        "shift_type": s.shift_type,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "color": s.color,
        "description": s.description,
        "grace_period_minutes": s.grace_period_minutes,
        "is_night_shift": s.is_night_shift,
        "shift_margin": s.shift_margin,
        "core_working_hours": s.core_working_hours,
        "weekend_basis": s.weekend_basis,
        "provide_shift_allowance": s.provide_shift_allowance,
        "eligibility_criteria": _parse_json_field(s.eligibility_criteria),
        "weekend_days": _parse_json_field(s.weekend_days),
        "half_working_day_half_weekend": s.half_working_day_half_weekend,
        "define_statutory_weekends": s.define_statutory_weekends,
        "is_active": s.is_active,
        "created_at": str(s.created_at) if s.created_at else None,
    }

def mapping_to_dict(m):
    return {
        "id": m.id,
        "employee_id": m.employee_id,
        "employee_name": f"{m.employee.first_name} {m.employee.last_name}" if m.employee else None,
        "employee_code": m.employee.employee_id if m.employee else None,
        "department": m.employee.department.name if m.employee and m.employee.department else None,
        "shift_id": m.shift_id,
        "shift_name": m.shift.name if m.shift else None,
        "shift_start": m.shift.start_time if m.shift else None,
        "shift_end": m.shift.end_time if m.shift else None,
        "shift_color": m.shift.color if m.shift else None,
        "effective_from": str(m.effective_from),
        "effective_to": str(m.effective_to) if m.effective_to else None,
        "assigned_by": m.assigned_by,
        "assigner_name": f"{m.assigner.first_name} {m.assigner.last_name}" if m.assigner else None,
        "notes": m.notes,
        "is_active": m.is_active,
        "created_at": str(m.created_at) if m.created_at else None,
    }

def swap_to_dict(sw):
    return {
        "id": sw.id,
        "requester_id": sw.requester_id,
        "requester_name": f"{sw.requester.first_name} {sw.requester.last_name}" if sw.requester else None,
        "requested_employee_id": sw.requested_employee_id,
        "requested_employee_name": f"{sw.requested_employee.first_name} {sw.requested_employee.last_name}" if sw.requested_employee else None,
        "swap_date": str(sw.swap_date),
        "requester_shift_id": sw.requester_shift_id,
        "requester_shift": sw.requester_shift.name if sw.requester_shift else None,
        "requested_shift_id": sw.requested_shift_id,
        "requested_shift": sw.requested_shift.name if sw.requested_shift else None,
        "reason": sw.reason,
        "status": sw.status,
        "approved_by": sw.approved_by,
        "approver_name": f"{sw.approver.first_name} {sw.approver.last_name}" if sw.approver else None,
        "created_at": str(sw.created_at) if sw.created_at else None,
    }


# ── Employee Search ───────────────────────────────────────────────────────────

@router.get("/employees/search")
def search_employees(
    q: str,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    if len(q.strip()) < 1:
        return []
    term = f"%{q.strip()}%"
    full_name = func.concat(Employee.first_name, ' ', Employee.last_name)
    employees = db.query(Employee).filter(
        or_(
            Employee.first_name.ilike(term),
            Employee.last_name.ilike(term),
            full_name.ilike(term),
            Employee.employee_id.ilike(term),
            Employee.email.ilike(term),
        )
    ).order_by(Employee.first_name, Employee.last_name).limit(20).all()
    return [
        {
            "id": e.id,
            "employee_id": e.employee_id,
            "name": f"{e.first_name} {e.last_name}",
            "email": e.email,
            "department": e.department.name if e.department else None,
            "title": e.title,
            "profile_picture": e.profile_picture,
        }
        for e in employees
    ]


# ── Employee-specific shift info ──────────────────────────────────────────────

@router.get("/employees/{employee_id}/current-shift")
def get_employee_current_shift(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    today = date.today()
    mapping = (
        db.query(EmployeeShiftMapping)
        .filter(
            EmployeeShiftMapping.employee_id == employee_id,
            EmployeeShiftMapping.is_active == True,
            EmployeeShiftMapping.effective_from <= today,
            (EmployeeShiftMapping.effective_to == None) | (EmployeeShiftMapping.effective_to >= today)
        )
        .order_by(EmployeeShiftMapping.effective_from.desc())
        .first()
    )
    if not mapping:
        return None
    return mapping_to_dict(mapping)

@router.get("/employees/{employee_id}/shift-history")
def get_employee_shift_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    mappings = (
        db.query(EmployeeShiftMapping)
        .filter(EmployeeShiftMapping.employee_id == employee_id)
        .order_by(EmployeeShiftMapping.effective_from.desc())
        .all()
    )
    return [mapping_to_dict(m) for m in mappings]

@router.get("/employees/{employee_id}/swap-requests")
def get_employee_swap_requests(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    swaps = (
        db.query(ShiftSwapRequest)
        .filter(
            (ShiftSwapRequest.requester_id == employee_id) |
            (ShiftSwapRequest.requested_employee_id == employee_id)
        )
        .order_by(ShiftSwapRequest.created_at.desc())
        .all()
    )
    return [swap_to_dict(s) for s in swaps]


# ── Shifts ────────────────────────────────────────────────────────────────────

@router.get("/user-specific")
def get_user_specific_calendar(
    employee_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    mappings = db.query(EmployeeShiftMapping).filter(
        EmployeeShiftMapping.employee_id == employee_id,
        EmployeeShiftMapping.is_active == True,
        EmployeeShiftMapping.effective_from <= end_date,
        or_(
            EmployeeShiftMapping.effective_to == None,
            EmployeeShiftMapping.effective_to >= start_date
        )
    ).order_by(EmployeeShiftMapping.effective_from.desc()).all()

    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee.employee_id,
        LeaveRequest.status == "approved",
        LeaveRequest.start_date <= end_date,
        LeaveRequest.end_date >= start_date
    ).all()

    events = {}
    current = start_date
    while current <= end_date:
        day_events = []
        for m in mappings:
            if m.effective_from <= current and (m.effective_to is None or m.effective_to >= current):
                day_events.append({
                    "type": "shift",
                    "mapping_id": m.id,
                    "shift_id": m.shift_id,
                    "shift_name": m.shift.name,
                    "start_time": m.shift.start_time,
                    "end_time": m.shift.end_time,
                    "color": m.shift.color or "#6366f1",
                })
                break  # Most recent active mapping wins

        for l in leaves:
            if l.start_date <= current <= l.end_date:
                day_events.append({
                    "type": "leave",
                    "leave_id": l.id,
                    "leave_name": l.leave_type.name if l.leave_type else "Leave",
                    "color": "#8b5cf6",
                })

        events[str(current)] = day_events
        current += timedelta(days=1)

    return {
        "employee_id": employee.id,
        "employee_code": employee.employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "events": events,
    }


@router.get("/mappings/calendar")
def get_mappings_calendar(
    start_date: date,
    end_date: date,
    department_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    emp_query = db.query(Employee).filter(Employee.status == StatusEnum.active)
    if department_id:
        emp_query = emp_query.filter(Employee.department_id == department_id)

    total = emp_query.count()
    employees = emp_query.order_by(Employee.first_name, Employee.last_name).offset(skip).limit(limit).all()

    result = []
    for emp in employees:
        mappings = db.query(EmployeeShiftMapping).filter(
            EmployeeShiftMapping.employee_id == emp.id,
            EmployeeShiftMapping.is_active == True,
            EmployeeShiftMapping.effective_from <= end_date,
            or_(
                EmployeeShiftMapping.effective_to == None,
                EmployeeShiftMapping.effective_to >= start_date
            )
        ).order_by(EmployeeShiftMapping.effective_from.desc()).all()

        leaves = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == emp.employee_id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date
        ).all()

        days = {}
        current = start_date
        while current <= end_date:
            day_events = []
            for m in mappings:
                if m.effective_from <= current and (m.effective_to is None or m.effective_to >= current):
                    day_events.append({
                        "type": "shift",
                        "shift_name": m.shift.name,
                        "start_time": m.shift.start_time,
                        "end_time": m.shift.end_time,
                        "color": m.shift.color or "#6366f1",
                    })
                    break
            for l in leaves:
                if l.start_date <= current <= l.end_date:
                    day_events.append({
                        "type": "leave",
                        "leave_name": l.leave_type.name if l.leave_type else "Leave",
                        "color": "#8b5cf6",
                    })
            days[str(current)] = day_events
            current += timedelta(days=1)

        result.append({
            "employee_id": emp.id,
            "employee_code": emp.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "profile_picture": emp.profile_picture,
            "department": emp.department.name if emp.department else None,
            "days": days,
        })

    return {"total": total, "employees": result}


@router.get("/")
def get_shifts(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    query = db.query(Shift)
    if active_only:
        query = query.filter(Shift.is_active == True)
    return [shift_to_dict(s) for s in query.order_by(Shift.name).all()]

@router.post("/")
def create_shift(
    data: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    shift = Shift(**_prep_shift_payload(data.dict()), created_by=current_user.id)
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift_to_dict(shift)

@router.put("/{shift_id}")
def update_shift(
    shift_id: int,
    data: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    for k, v in _prep_shift_payload(data.dict(exclude_none=True)).items():
        setattr(shift, k, v)
    db.commit()
    db.refresh(shift)
    return shift_to_dict(shift)

@router.delete("/{shift_id}")
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    # Null out nullable FK references in swap requests
    db.query(ShiftSwapRequest).filter(
        ShiftSwapRequest.requester_shift_id == shift_id
    ).update({"requester_shift_id": None}, synchronize_session=False)
    db.query(ShiftSwapRequest).filter(
        ShiftSwapRequest.requested_shift_id == shift_id
    ).update({"requested_shift_id": None}, synchronize_session=False)

    # Delete all employee mappings for this shift
    db.query(EmployeeShiftMapping).filter(
        EmployeeShiftMapping.shift_id == shift_id
    ).delete(synchronize_session=False)

    db.delete(shift)
    db.commit()
    return {"message": "Shift deleted"}


# ── Employee Shift Mappings ───────────────────────────────────────────────────

@router.get("/mappings")
def get_all_mappings(
    active_only: bool = True,
    department_id: Optional[int] = None,
    shift_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    query = db.query(EmployeeShiftMapping)
    if active_only:
        query = query.filter(EmployeeShiftMapping.is_active == True)
    if shift_id:
        query = query.filter(EmployeeShiftMapping.shift_id == shift_id)
    if department_id:
        query = query.join(Employee).filter(Employee.department_id == department_id)
    total = query.count()
    mappings = query.order_by(EmployeeShiftMapping.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "mappings": [mapping_to_dict(m) for m in mappings]}

@router.post("/mappings")
def assign_shift(
    data: EmployeeShiftMappingCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    employee = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    shift = db.query(Shift).filter(Shift.id == data.shift_id, Shift.is_active == True).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found or inactive")

    # Deactivate any overlapping active mappings
    existing = db.query(EmployeeShiftMapping).filter(
        EmployeeShiftMapping.employee_id == data.employee_id,
        EmployeeShiftMapping.is_active == True
    ).all()
    for m in existing:
        m.is_active = False

    mapping = EmployeeShiftMapping(
        **data.dict(),
        assigned_by=current_user.id
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping_to_dict(mapping)

@router.put("/mappings/{mapping_id}")
def update_mapping(
    mapping_id: int,
    data: EmployeeShiftMappingUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    mapping = db.query(EmployeeShiftMapping).filter(EmployeeShiftMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(mapping, k, v)
    db.commit()
    db.refresh(mapping)
    return mapping_to_dict(mapping)

@router.delete("/mappings/{mapping_id}")
def remove_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    mapping = db.query(EmployeeShiftMapping).filter(EmployeeShiftMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    mapping.is_active = False
    db.commit()
    return {"message": "Shift mapping removed"}


# ── Shift Swap Requests ───────────────────────────────────────────────────────

@router.post("/swaps")
def request_swap(
    data: ShiftSwapCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    target = db.query(Employee).filter(Employee.id == data.requested_employee_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Requested employee not found")
    swap = ShiftSwapRequest(
        requester_id=current_user.id,
        **data.dict()
    )
    db.add(swap)
    db.commit()
    db.refresh(swap)
    create_notification(
        db, user_id=target.id, type="shift_swap_requested",
        title=f"{current_user.first_name} {current_user.last_name} wants to swap shifts with you",
        body=f"Swap requested for {data.swap_date}" + (f" — {data.reason}" if data.reason else ""),
        link="/shift-roster",
    )
    db.commit()
    return swap_to_dict(swap)

@router.get("/swaps")
def get_swaps(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    query = db.query(ShiftSwapRequest)
    if status:
        query = query.filter(ShiftSwapRequest.status == status)
    return [swap_to_dict(s) for s in query.order_by(ShiftSwapRequest.created_at.desc()).all()]

@router.put("/swaps/{swap_id}/approve")
def approve_swap(
    swap_id: int,
    data: ShiftSwapApproval,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    swap = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == swap_id).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    swap.status = data.status
    swap.approved_by = current_user.id
    db.commit()
    create_notification(
        db, user_id=swap.requester_id, type=f"shift_swap_{data.status}",
        title=f"Your shift swap request was {data.status}",
        body=f"Swap for {swap.swap_date} was {data.status} by {current_user.first_name} {current_user.last_name}",
        link="/shift-roster",
    )
    db.commit()
    return swap_to_dict(swap)


# ── Stats summary ─────────────────────────────────────────────────────────────

@router.get("/stats")
def get_shift_stats(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    today = date.today()
    total_shifts = db.query(Shift).filter(Shift.is_active == True).count()
    total_mapped = db.query(EmployeeShiftMapping).filter(
        EmployeeShiftMapping.is_active == True,
        EmployeeShiftMapping.effective_from <= today,
        (EmployeeShiftMapping.effective_to == None) | (EmployeeShiftMapping.effective_to >= today)
    ).count()
    pending_swaps = db.query(ShiftSwapRequest).filter(
        ShiftSwapRequest.status == ShiftSwapStatusEnum.pending
    ).count()
    return {
        "total_shifts": total_shifts,
        "total_mapped_employees": total_mapped,
        "pending_swaps": pending_swaps,
    }
