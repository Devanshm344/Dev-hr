from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
from pathlib import Path
import uuid
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, LeaveRequest, LeaveType, LeaveEnablementRequest
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role
from app.core.config import settings
from app.services.leave_calculation import (
    get_leave_balance_overview, process_leave_approval, override_leave_decision,
    is_employee_eligible, preview_leave, reserve_leave_days, cancel_pending_leave,
)
from app.services.notifications import create_notification

router = APIRouter()

def _notify_leave_decision(db: Session, leave: LeaveRequest, status: str) -> None:
    if status not in ("approved", "rejected") or not leave.employee:
        return
    create_notification(
        db, user_id=leave.employee.id,
        type=f"leave_{status}",
        title=f"Your leave request was {status}",
        body=f"{leave.days} day(s), {leave.start_date} to {leave.end_date}",
        link="/leave",
    )

class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    day_part: str = "full"  # full | half
    reason: Optional[str] = None
    team_email: Optional[str] = None
    attachment_url: Optional[str] = None

class LeaveApproval(BaseModel):
    status: str  # approved / rejected
    rejection_reason: Optional[str] = None

class BulkLeaveApproval(BaseModel):
    ids: List[int]
    status: str  # approved / rejected
    rejection_reason: Optional[str] = None

class LeaveTypeCreate(BaseModel):
    name: str
    code: str
    days_allowed: int
    carry_forward: bool = False
    paid: bool = True
    description: Optional[str] = None

def leave_to_dict(leave):
    return {
        "id": leave.id,
        "employee_id": leave.employee_id,
        "employee_name": f"{leave.employee.first_name} {leave.employee.last_name}" if leave.employee else None,
        "employee_code": leave.employee.employee_id if leave.employee else None,
        "leave_type_id": leave.leave_type_id,
        "leave_type": leave.leave_type.name if leave.leave_type else None,
        "start_date": str(leave.start_date),
        "end_date": str(leave.end_date),
        "days": leave.days,
        "reason": leave.reason,
        "team_email": getattr(leave, "team_email", None),
        "attachment_url": getattr(leave, "attachment_url", None),
        "status": leave.status,
        "approved_by": leave.approved_by,
        "approver": f"{leave.approver.first_name} {leave.approver.last_name}" if leave.approver else None,
        "approver_employee_code": leave.approver.employee_id if leave.approver else None,
        "rejection_reason": leave.rejection_reason,
        "created_at": str(leave.created_at) if leave.created_at else None,
        "approved_at": str(leave.approved_at) if leave.approved_at else None,
    }

@router.get("/types")
def get_leave_types(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    return db.query(LeaveType).filter(LeaveType.is_active == True).all()

@router.post("/types")
def create_leave_type(data: LeaveTypeCreate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    lt = LeaveType(**data.dict())
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return lt

@router.get("/balance")
def get_my_balance(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    from datetime import datetime
    y = year or datetime.now().year
    return get_leave_balance_overview(db, current_user, y)

@router.get("/my")
def get_my_leaves(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    query = db.query(LeaveRequest).filter(LeaveRequest.employee_id == current_user.employee_id)
    if status:
        query = query.filter(LeaveRequest.status == status)
    return [leave_to_dict(l) for l in query.order_by(LeaveRequest.created_at.desc()).all()]

@router.get("/preview")
def get_leave_preview(
    leave_type_id: int,
    start_date: date,
    end_date: date,
    day_part: str = "full",
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Non-mutating calculation: requested days, projected balance after
    booking, and whether Apply Leave should be allowed. No DB writes — the
    exact same preview_leave() call apply_leave() below uses, so preview and
    apply can never disagree."""
    leave_type = db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    return preview_leave(db, current_user, leave_type, start_date, end_date, day_part)


@router.get("/eligibility")
def get_leave_eligibility(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Per-leave-type eligibility for the current user, driven entirely by
    LeaveTypeEligibilityRule — frontends should read this instead of carrying
    their own hardcoded gender/manager rules."""
    leave_types = db.query(LeaveType).filter(LeaveType.is_active == True).all()
    return [
        {"leave_type_id": lt.id, "leave_type": lt.name, "eligible": is_employee_eligible(db, current_user, lt)}
        for lt in leave_types
    ]


@router.post("/apply")
def apply_leave(
    data: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    preview = preview_leave(db, current_user, leave_type, data.start_date, data.end_date, data.day_part)
    if not preview["allow_apply"]:
        raise HTTPException(status_code=400, detail=preview["message"] or "This leave request cannot be submitted.")

    leave = LeaveRequest(
        employee_id=current_user.employee_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        days=preview["current_booking"],
        day_part=data.day_part,
        reason=data.reason,
        team_email=data.team_email,
        attachment_url=data.attachment_url,
        status="pending"
    )
    db.add(leave)
    db.flush()  # assigns leave.id, needed for the reservation's ledger reference

    try:
        reserve_leave_days(db, leave)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    if current_user.manager_id:
        create_notification(
            db, user_id=current_user.manager_id, type="leave_requested",
            title=f"{current_user.first_name} {current_user.last_name} requested leave",
            body=f"{leave.days} day(s) of {leave_type.name}, {data.start_date} to {data.end_date}",
            link="/leave",
        )

    db.commit()
    db.refresh(leave)
    return leave_to_dict(leave)

class EnablementRequestCreate(BaseModel):
    leave_type_id: int
    reason: Optional[str] = None


def enablement_to_dict(req: LeaveEnablementRequest) -> dict:
    return {
        "id": req.id,
        "leave_type_id": req.leave_type_id,
        "leave_type": req.leave_type.name if req.leave_type else None,
        "status": req.status.value if hasattr(req.status, "value") else req.status,
        "reason": req.reason,
        "rejection_reason": req.rejection_reason,
        "created_at": str(req.created_at) if req.created_at else None,
        "reviewed_at": str(req.reviewed_at) if req.reviewed_at else None,
    }


@router.post("/enablement-requests")
def request_leave_enablement(
    data: EnablementRequestCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    leave_type = db.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    if not leave_type.requires_admin_enable:
        raise HTTPException(status_code=400, detail=f"{leave_type.name} does not require enablement")
    if not is_employee_eligible(db, current_user, leave_type):
        raise HTTPException(status_code=403, detail=f"You are not eligible for {leave_type.name}")

    existing = db.query(LeaveEnablementRequest).filter(
        LeaveEnablementRequest.employee_id == current_user.employee_id,
        LeaveEnablementRequest.leave_type_id == leave_type.id,
        LeaveEnablementRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A request for this leave type is already pending")

    req = LeaveEnablementRequest(
        employee_id=current_user.employee_id, leave_type_id=leave_type.id, reason=data.reason,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return enablement_to_dict(req)


@router.get("/enablement-requests/my")
def get_my_enablement_requests(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    reqs = (
        db.query(LeaveEnablementRequest)
        .filter(LeaveEnablementRequest.employee_id == current_user.employee_id)
        .order_by(LeaveEnablementRequest.created_at.desc())
        .all()
    )
    return [enablement_to_dict(r) for r in reqs]


@router.post("/upload")
async def upload_leave_attachment(
    file: UploadFile = File(...),
    current_user: Employee = Depends(get_current_user)
):
    max_bytes = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5 MB.")

    upload_dir = Path(settings.UPLOAD_DIR) / "leave-attachments"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix if file.filename else ""
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / unique_name

    with open(file_path, "wb") as buf:
        buf.write(content)

    return {
        "file_url": str(file_path).replace("\\", "/"),
        "file_name": file.filename,
        "file_size": len(content),
    }


@router.get("/pending")
def get_pending_leaves(
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    if is_admin_role(get_effective_role(current_user, auth_db)):
        leaves = db.query(LeaveRequest).filter(LeaveRequest.status == "pending").all()
    else:
        raise HTTPException(status_code=403, detail="Admin access required")
    return [leave_to_dict(l) for l in leaves]

@router.get("/team-pending")
def get_team_pending_leaves(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Pending leave requests for employees who report directly to the logged-in
    manager, determined solely via Employee.manager_id (no role check)."""
    report_codes = [
        e.employee_id for e in db.query(Employee.employee_id).filter(Employee.manager_id == current_user.id).all()
    ]
    is_manager = len(report_codes) > 0
    leaves = []
    if is_manager:
        leaves = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id.in_(report_codes),
            LeaveRequest.status == "pending"
        ).order_by(LeaveRequest.created_at.desc()).all()
    return {
        "is_manager": is_manager,
        "leaves": [leave_to_dict(l) for l in leaves],
    }

@router.get("/all")
def get_all_leaves(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    query = db.query(LeaveRequest)
    if status:
        query = query.filter(LeaveRequest.status == status)
    if employee_id:
        query = query.filter(LeaveRequest.employee_id == employee_id)
    total = query.count()
    return {
        "total": total,
        "leaves": [leave_to_dict(l) for l in query.order_by(LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()]
    }

@router.put("/{leave_id}/approve")
def approve_leave(
    leave_id: int,
    data: LeaveApproval,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user)
):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    is_direct_manager = leave.employee.manager_id == current_user.id
    if not is_admin and not is_direct_manager:
        raise HTTPException(status_code=403, detail="Not authorized to approve this leave request")

    try:
        if is_admin and leave.status in ("approved", "rejected"):
            override_leave_decision(db, leave, current_user.id, data.status)
        else:
            process_leave_approval(db, leave, current_user.id, data.status, data.rejection_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _notify_leave_decision(db, leave, data.status)
    db.commit()
    return leave_to_dict(leave)

@router.post("/bulk-approve")
def bulk_approve_leaves(
    data: BulkLeaveApproval,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    """Approve/reject multiple pending leave requests in one call — same
    authorization and processing logic as approve_leave, looped per id so one
    failure doesn't abort the rest of the batch."""
    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    results = []
    for leave_id in data.ids:
        leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
        if not leave:
            results.append({"id": leave_id, "success": False, "error": "Not found"})
            continue

        is_direct_manager = leave.employee.manager_id == current_user.id
        if not is_admin and not is_direct_manager:
            results.append({"id": leave_id, "success": False, "error": "Not authorized to approve this leave request"})
            continue

        try:
            if is_admin and leave.status in ("approved", "rejected"):
                override_leave_decision(db, leave, current_user.id, data.status)
            else:
                process_leave_approval(db, leave, current_user.id, data.status, data.rejection_reason)
        except ValueError as e:
            results.append({"id": leave_id, "success": False, "error": str(e)})
            continue

        _notify_leave_decision(db, leave, data.status)
        results.append({
            "id": leave_id,
            "employee_name": f"{leave.employee.first_name} {leave.employee.last_name}" if leave.employee else None,
            "success": True,
        })

    db.commit()
    return {"results": results}

@router.delete("/{leave_id}")
def cancel_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="Permission denied")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending leaves can be cancelled")
    cancel_pending_leave(db, leave, current_user.id)
    db.commit()
    return {"message": "Leave cancelled"}
