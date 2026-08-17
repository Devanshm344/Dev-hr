from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field
from datetime import date, datetime

from app.db.database import get_db, get_auth_db
from app.models.base import (
    Employee, LeaveRequest, LeaveType, LeaveBalance, Holiday,
    LeaveEnablementRequest, LeaveTransactionTypeEnum, LeaveTypeEligibilityRule,
)
from app.core.security import get_current_admin, get_current_user
from app.services.leave_calculation import (
    update_balance_fields, get_leave_balance_overview, process_leave_approval,
    get_or_create_leave_balance, record_leave_transaction,
)
from app.services import leave_scheduler
from app.services.holiday_pdf_parser import parse_holiday_pdf

router = APIRouter()

HOLIDAY_REGIONS = {"India", "United States", "Canada"}


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class HolidayCreate(BaseModel):
    name: str
    date: date
    region: str = "India"  # 'India' | 'United States' | 'Canada' — matches Employee.country
    holiday_type: str = "public"
    description: Optional[str] = None


class ParsedHolidayRow(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    date: date
    holiday_type: str = "public"


class HolidayBulkApply(BaseModel):
    region: str
    year: int
    holidays: list[ParsedHolidayRow]


class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = None
    days_allowed: Optional[int] = None
    carry_forward: Optional[bool] = None
    paid: Optional[bool] = None
    description: Optional[str] = None
    # ── Policy configuration (config-driven leave engine) ──────────────────
    accrual_mode: Optional[str] = None               # none | monthly_credit | monthly_reset | yearly_allocation
    accrual_amount: Optional[float] = None
    max_balance: Optional[float] = None
    carry_forward_limit: Optional[float] = None
    encashment_limit: Optional[float] = None
    feeds_bucket_type_id: Optional[int] = None
    lapses_at_year_end: Optional[bool] = None
    day_count_mode: Optional[str] = None              # weekday | calendar
    requires_admin_enable: Optional[bool] = None
    max_applications_per_year: Optional[int] = None


class EligibilityRuleUpdate(BaseModel):
    rule_type: str    # gender | manager_flag
    rule_value: str   # "female"/"male" for gender; "true"/"false" for manager_flag


class EligibilityRulesUpdate(BaseModel):
    rules: list[EligibilityRuleUpdate]


class BalanceUpdate(BaseModel):
    total_days: Optional[float] = None
    used_days: Optional[float] = None
    remaining_days: Optional[float] = None


class LeaveApprovalAction(BaseModel):
    status: str  # "approved" | "rejected"
    rejection_reason: Optional[str] = None


# ── Serializers ───────────────────────────────────────────────────────────────

def _employee_brief(emp: Employee, dept_name: Optional[str] = None) -> dict:
    return {
        "id": emp.id,
        "employee_id": emp.employee_id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "full_name": f"{emp.first_name} {emp.last_name}",
        "email": emp.email,
        "department": dept_name,
        "job_role": emp.job_role,
        "title": emp.title,
        "status": emp.status.value if emp.status else None,
        "profile_picture": emp.profile_picture,
        "date_of_joining": str(emp.date_of_joining) if emp.date_of_joining else None,
    }


def _leave_dict(leave: LeaveRequest) -> dict:
    return {
        "id": leave.id,
        "employee_id": leave.employee_id,
        "employee_name": f"{leave.employee.first_name} {leave.employee.last_name}"
        if leave.employee
        else None,
        "leave_type_id": leave.leave_type_id,
        "leave_type": leave.leave_type.name if leave.leave_type else None,
        "start_date": str(leave.start_date),
        "end_date": str(leave.end_date),
        "days": leave.days,
        "reason": leave.reason,
        "status": leave.status,
        "approved_by": leave.approved_by,
        "approver": f"{leave.approver.first_name} {leave.approver.last_name}"
        if leave.approver
        else None,
        "rejection_reason": leave.rejection_reason,
        "created_at": str(leave.created_at) if leave.created_at else None,
    }


def _holiday_dict(h: Holiday) -> dict:
    return {
        "id": h.id,
        "name": h.name,
        "date": str(h.date),
        "region": h.region,
        "holiday_type": h.holiday_type,
        "description": h.description,
        "year": h.year,
    }


def _balance_dict(b: LeaveBalance, db: Session) -> dict:
    lt = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
    return {
        "id": b.id,
        "leave_type_id": b.leave_type_id,
        "leave_type": lt.name if lt else None,
        "total_days": b.total_days,
        "used_days": b.used_days,
        "remaining_days": b.remaining_days,
        "year": b.year,
    }


def _compute_leave_metrics(db: Session) -> dict:
    today = date.today()
    month_start = date(today.year, today.month, 1)

    total_pending = db.query(LeaveRequest).filter(LeaveRequest.status == "pending").count()
    approved_this_month = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.status == "approved", LeaveRequest.start_date >= month_start)
        .count()
    )
    rejected_this_month = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.status == "rejected", LeaveRequest.start_date >= month_start)
        .count()
    )
    on_leave_today = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today,
        )
        .count()
    )

    return {
        "total_pending": total_pending,
        "approved_this_month": approved_this_month,
        "rejected_this_month": rejected_this_month,
        "on_leave_today": on_leave_today,
    }


# ── Employee Search ───────────────────────────────────────────────────────────

@router.get("/employees/search")
def search_employees(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    term = f"%{q.strip()}%"
    employees = (
        db.query(Employee)
        .filter(
            Employee.status != "terminated",
            (
                Employee.first_name.ilike(term)
                | Employee.last_name.ilike(term)
                | Employee.email.ilike(term)
                | Employee.employee_id.ilike(term)
            ),
        )
        .limit(20)
        .all()
    )
    return [_employee_brief(emp, emp.department.name if emp.department else None) for emp in employees]


# ── Employee Summary ──────────────────────────────────────────────────────────

@router.get("/employees/{emp_id}/summary")
def get_employee_summary(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    return {
        "employee": _employee_brief(emp, emp.department.name if emp.department else None),
    }


# ── Leave Balance ─────────────────────────────────────────────────────────────

@router.get("/employees/{emp_id}/balance")
def get_employee_balance(
    emp_id: int,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    target_year = year or datetime.now().year
    return get_leave_balance_overview(db, emp, target_year)


@router.put("/employees/{emp_id}/balance/{balance_id}")
def update_employee_balance(
    emp_id: int,
    balance_id: int,
    data: BalanceUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    balance = (
        db.query(LeaveBalance)
        .filter(LeaveBalance.id == balance_id, LeaveBalance.employee_id == emp.employee_id)
        .first()
    )
    if not balance:
        raise HTTPException(status_code=404, detail="Balance record not found")

    update_balance_fields(balance, data.total_days, data.used_days, data.remaining_days)

    db.commit()
    db.refresh(balance)
    return _balance_dict(balance, db)


# ── Per-Employee Leave Request Queries ────────────────────────────────────────

@router.get("/employees/{emp_id}/requests")
def get_employee_requests(
    emp_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    query = db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.employee_id)
    if status:
        query = query.filter(LeaveRequest.status == status)
    return [_leave_dict(r) for r in query.order_by(LeaveRequest.created_at.desc()).all()]


@router.get("/employees/{emp_id}/pending")
def get_employee_pending(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == emp.employee_id, LeaveRequest.status == "pending")
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
    return [_leave_dict(r) for r in requests]


@router.get("/employees/{emp_id}/approved")
def get_employee_approved(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == emp.employee_id, LeaveRequest.status == "approved")
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
    return [_leave_dict(r) for r in requests]


@router.get("/employees/{emp_id}/rejected")
def get_employee_rejected(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == emp.employee_id, LeaveRequest.status == "rejected")
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
    return [_leave_dict(r) for r in requests]


@router.get("/employees/{emp_id}/compoff")
def get_employee_compoff(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    comp_type = (
        db.query(LeaveType)
        .filter(LeaveType.name.ilike("%comp%"))
        .first()
    )
    if not comp_type:
        return {
            "leave_type": "Compensatory Off",
            "leave_type_id": None,
            "available_days": 0,
            "used_days": 0,
            "total_days": 0,
            "year": datetime.now().year,
        }

    year = datetime.now().year
    balance = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == emp.employee_id,
            LeaveBalance.leave_type_id == comp_type.id,
            LeaveBalance.year == year,
        )
        .first()
    )
    return {
        "leave_type": comp_type.name,
        "leave_type_id": comp_type.id,
        "available_days": balance.remaining_days if balance else 0,
        "used_days": balance.used_days if balance else 0,
        "total_days": balance.total_days if balance else 0,
        "year": year,
    }


# ── All Requests (Leave Requests tab) ────────────────────────────────────────

@router.get("/requests")
def get_all_requests(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    query = db.query(LeaveRequest)
    if status:
        query = query.filter(LeaveRequest.status == status)
    total = query.count()
    items = query.order_by(LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "requests": [_leave_dict(r) for r in items]}


# ── Compensatory Requests (Comp Requests tab) ─────────────────────────────────

@router.get("/comp-requests")
def get_comp_requests(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    comp_type = (
        db.query(LeaveType)
        .filter(LeaveType.name.ilike("%comp%"))
        .first()
    )
    if not comp_type:
        return {"total": 0, "requests": [], "comp_type": None}

    query = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.leave_type_id == comp_type.id)
    )
    if status:
        query = query.filter(LeaveRequest.status == status)

    total = query.count()
    items = query.order_by(LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "requests": [_leave_dict(r) for r in items],
        "comp_type": comp_type.name,
    }


# ── Approve / Reject Leave (Leave Tracker scope) ──────────────────────────────

@router.put("/requests/{leave_id}/approve")
def approve_leave_request(
    leave_id: int,
    data: LeaveApprovalAction,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")

    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    try:
        process_leave_approval(db, leave, current_user.id, data.status, data.rejection_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    return _leave_dict(leave)


# ── Holidays ──────────────────────────────────────────────────────────────────

@router.get("/holidays")
def get_holidays(
    year: Optional[int] = None,
    region: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Defaults to the caller's own office (Employee.country) — a personal
    "my holidays" list. Pass region=all to see every office's calendar (the
    admin Holidays management tab does this); pass an explicit region to see
    just that one."""
    target_year = year or datetime.now().year
    query = db.query(Holiday).filter(Holiday.year == target_year)
    if region and region.lower() != "all":
        query = query.filter(Holiday.region == region)
    elif not region:
        query = query.filter(Holiday.region == (current_user.country or "India"))
    holidays = query.order_by(Holiday.date).all()
    return {"year": target_year, "holidays": [_holiday_dict(h) for h in holidays]}


@router.post("/holidays")
def create_holiday(
    data: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    if data.region not in HOLIDAY_REGIONS:
        raise HTTPException(status_code=400, detail=f"region must be one of {sorted(HOLIDAY_REGIONS)}")
    existing = db.query(Holiday).filter(Holiday.date == data.date, Holiday.region == data.region).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A {data.region} holiday already exists on this date")

    h = Holiday(
        name=data.name,
        date=data.date,
        region=data.region,
        holiday_type=data.holiday_type,
        description=data.description,
        year=data.date.year,
        created_by=current_user.id,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _holiday_dict(h)


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    h = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(h)
    db.commit()
    return {"message": "Holiday deleted"}


@router.post("/holidays/parse-pdf")
def parse_holiday_pdf_route(
    file: UploadFile = File(...),
    year: int = Form(...),
    current_user: Employee = Depends(get_current_admin),
):
    """Deterministic table extraction only — no DB write. Returns a preview
    for the admin to review/correct before calling /holidays/bulk-apply."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF file")
    content = file.file.read()
    try:
        result = parse_holiday_pdf(content, year)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this PDF — is it a valid, non-scanned PDF?")
    if not result["rows"]:
        raise HTTPException(status_code=400, detail="No holiday rows could be read from this PDF. Try adding them manually.")
    return result


@router.post("/holidays/bulk-apply")
def bulk_apply_holidays(
    data: HolidayBulkApply,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    """The reviewed PDF becomes the source of truth for this region+year:
    replaces whatever holidays already existed for it, rather than merging,
    so a corrected re-upload (a moved date, a removed holiday) actually
    takes effect instead of leaving stale rows behind."""
    if data.region not in HOLIDAY_REGIONS:
        raise HTTPException(status_code=400, detail=f"region must be one of {sorted(HOLIDAY_REGIONS)}")
    if not data.holidays:
        raise HTTPException(status_code=400, detail="No holidays to apply")

    db.query(Holiday).filter(Holiday.region == data.region, Holiday.year == data.year).delete()

    for row in data.holidays:
        db.add(Holiday(
            name=row.name,
            date=row.date,
            region=data.region,
            holiday_type=row.holiday_type,
            year=data.year,
            created_by=current_user.id,
        ))
    db.commit()

    holidays = (
        db.query(Holiday)
        .filter(Holiday.region == data.region, Holiday.year == data.year)
        .order_by(Holiday.date)
        .all()
    )
    return {"region": data.region, "year": data.year, "holidays": [_holiday_dict(h) for h in holidays]}


# ── Enablement Requests (Maternity / Paternity self-enable workflow) ──────────

def _enablement_dict(req: LeaveEnablementRequest) -> dict:
    return {
        "id": req.id,
        "employee_id": req.employee_id,
        "employee_name": f"{req.employee.first_name} {req.employee.last_name}" if req.employee else None,
        "leave_type_id": req.leave_type_id,
        "leave_type": req.leave_type.name if req.leave_type else None,
        "status": req.status.value if hasattr(req.status, "value") else req.status,
        "reason": req.reason,
        "rejection_reason": req.rejection_reason,
        "created_at": str(req.created_at) if req.created_at else None,
        "reviewed_at": str(req.reviewed_at) if req.reviewed_at else None,
        "reviewer": f"{req.reviewer.first_name} {req.reviewer.last_name}" if req.reviewer else None,
    }


@router.get("/enablement-requests")
def get_enablement_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    query = db.query(LeaveEnablementRequest)
    if status:
        query = query.filter(LeaveEnablementRequest.status == status)
    reqs = query.order_by(LeaveEnablementRequest.created_at.desc()).all()
    return [_enablement_dict(r) for r in reqs]


class EnablementDecision(BaseModel):
    status: str  # approved | rejected
    rejection_reason: Optional[str] = None


@router.put("/enablement-requests/{request_id}/decision")
def decide_enablement_request(
    request_id: int,
    data: EnablementDecision,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")

    req = db.query(LeaveEnablementRequest).filter(LeaveEnablementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Enablement request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="This request has already been decided")

    req.status = data.status
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now()
    req.rejection_reason = data.rejection_reason

    if data.status == "approved":
        leave_type = db.query(LeaveType).filter(LeaveType.id == req.leave_type_id).first()
        year = datetime.now().year
        amount = leave_type.accrual_amount or 0
        balance = get_or_create_leave_balance(db, req.employee_id, leave_type.id, year)
        balance.total_days = amount
        balance.remaining_days = amount
        record_leave_transaction(
            db, employee_id=req.employee_id, leave_type_id=leave_type.id, year=year,
            transaction_type=LeaveTransactionTypeEnum.year_initialization, amount=amount,
            balance_after=amount, reference=f"enablement:{req.id}", performed_by=current_user.id,
        )

    db.commit()
    return _enablement_dict(req)


# ── Leave Types (Customize Policy tab) ────────────────────────────────────────

def _leave_type_dict(lt: LeaveType) -> dict:
    return {
        "id": lt.id,
        "name": lt.name,
        "code": lt.code,
        "days_allowed": lt.days_allowed,
        "carry_forward": lt.carry_forward,
        "paid": lt.paid,
        "description": lt.description,
        "accrual_mode": lt.accrual_mode.value if hasattr(lt.accrual_mode, "value") else lt.accrual_mode,
        "accrual_amount": lt.accrual_amount,
        "max_balance": lt.max_balance,
        "carry_forward_limit": lt.carry_forward_limit,
        "encashment_limit": lt.encashment_limit,
        "feeds_bucket_type_id": lt.feeds_bucket_type_id,
        "lapses_at_year_end": lt.lapses_at_year_end,
        "day_count_mode": lt.day_count_mode.value if hasattr(lt.day_count_mode, "value") else lt.day_count_mode,
        "requires_admin_enable": lt.requires_admin_enable,
        "max_applications_per_year": lt.max_applications_per_year,
    }


@router.get("/leave-types")
def get_leave_types(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    return [_leave_type_dict(lt) for lt in db.query(LeaveType).filter(LeaveType.is_active == True).all()]


@router.put("/leave-types/{type_id}")
def update_leave_type(
    type_id: int,
    data: LeaveTypeUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    lt = db.query(LeaveType).filter(LeaveType.id == type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")

    updates = data.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(lt, field, value)

    db.commit()
    db.refresh(lt)
    return _leave_type_dict(lt)


@router.get("/leave-types/{type_id}/eligibility")
def get_leave_type_eligibility(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    lt = db.query(LeaveType).filter(LeaveType.id == type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")
    rules = db.query(LeaveTypeEligibilityRule).filter(LeaveTypeEligibilityRule.leave_type_id == type_id).all()
    return [
        {"rule_type": r.rule_type.value if hasattr(r.rule_type, "value") else r.rule_type, "rule_value": r.rule_value}
        for r in rules
    ]


@router.put("/leave-types/{type_id}/eligibility")
def update_leave_type_eligibility(
    type_id: int,
    data: EligibilityRulesUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    """Replaces all eligibility rules for this leave type with the given set —
    this is what makes gender/manager eligibility admin-editable rather than
    only seed-editable. An empty `rules` list removes all restrictions."""
    lt = db.query(LeaveType).filter(LeaveType.id == type_id).first()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")

    db.query(LeaveTypeEligibilityRule).filter(LeaveTypeEligibilityRule.leave_type_id == type_id).delete()
    for rule in data.rules:
        db.add(LeaveTypeEligibilityRule(leave_type_id=type_id, rule_type=rule.rule_type, rule_value=rule.rule_value))

    db.commit()
    rules = db.query(LeaveTypeEligibilityRule).filter(LeaveTypeEligibilityRule.leave_type_id == type_id).all()
    return [
        {"rule_type": r.rule_type.value if hasattr(r.rule_type, "value") else r.rule_type, "rule_value": r.rule_value}
        for r in rules
    ]


# ── Scheduler (manual trigger, for ops/testing without waiting on cron) ───────

SCHEDULER_JOBS = {
    "year_initialization": lambda db, year, month: leave_scheduler.run_year_initialization(db, year),
    "yearly_allocation": lambda db, year, month: leave_scheduler.run_yearly_allocation(db, year),
    "monthly_accrual": lambda db, year, month: leave_scheduler.run_monthly_accrual(db, year, month),
    "monthly_reset": lambda db, year, month: leave_scheduler.run_monthly_reset(db, year, month),
    "year_end_processing": lambda db, year, month: leave_scheduler.run_year_end_processing(db, year),
}


@router.post("/scheduler/run/{job_name}")
def run_scheduler_job(
    job_name: str,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    if job_name not in SCHEDULER_JOBS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown scheduler job '{job_name}'. Valid jobs: {', '.join(SCHEDULER_JOBS)}",
        )
    today = datetime.now()
    return SCHEDULER_JOBS[job_name](db, year or today.year, month or today.month)


# ── Metrics ───────────────────────────────────────────────────────────────────

@router.get("/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    metrics = _compute_leave_metrics(db)
    return {
        "total_pending": metrics["total_pending"],
        "approved_this_month": metrics["approved_this_month"],
        "rejected_this_month": metrics["rejected_this_month"],
        "employees_on_leave_today": metrics["on_leave_today"],
    }
