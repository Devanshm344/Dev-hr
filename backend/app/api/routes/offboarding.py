from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import date
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, OffboardingRequest, OffboardingChecklist
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role

router = APIRouter()

DEFAULT_CHECKLIST_ITEMS = [
    "Return company laptop and accessories",
    "Return access card / ID badge",
    "Complete knowledge transfer",
    "Settle pending expenses",
    "Complete exit survey",
    "Return company assets",
    "IT account deactivation confirmation",
    "Final payroll settlement",
]


class OffboardingCreate(BaseModel):
    resignation_date: date
    last_working_day: Optional[date] = None
    reason: Optional[str] = None


class OffboardingUpdate(BaseModel):
    last_working_day: Optional[date] = None
    reason: Optional[str] = None
    # admin-only fields
    hr_comments: Optional[str] = None
    clearance_status: Optional[str] = None


def offboarding_to_dict(o: OffboardingRequest):
    return {
        "id": o.id,
        "employee_id": o.employee_id,
        "employee_name": f"{o.employee.first_name} {o.employee.last_name}" if o.employee else None,
        "resignation_date": str(o.resignation_date) if o.resignation_date else None,
        "last_working_day": str(o.last_working_day) if o.last_working_day else None,
        "reason": o.reason,
        "status": o.status,
        "hr_comments": o.hr_comments,
        "exit_interview_date": str(o.exit_interview_date) if o.exit_interview_date else None,
        "clearance_status": o.clearance_status,
        "checklist": [
            {
                "id": c.id,
                "item": c.item,
                "is_completed": c.is_completed,
                "completed_at": str(c.completed_at) if c.completed_at else None,
            }
            for c in o.checklist_items
        ],
        "created_at": str(o.created_at) if o.created_at else None,
        "updated_at": str(o.updated_at) if o.updated_at else None,
    }


@router.post("/")
def submit_resignation(
    data: OffboardingCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    existing = db.query(OffboardingRequest).filter(
        OffboardingRequest.employee_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Resignation already submitted")

    req = OffboardingRequest(
        **data.dict(),
        employee_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(req)
    db.flush()

    for item_text in DEFAULT_CHECKLIST_ITEMS:
        db.add(OffboardingChecklist(offboarding_id=req.id, item=item_text))

    db.commit()
    db.refresh(req)
    return offboarding_to_dict(req)


@router.get("/my")
def get_my_offboarding(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(OffboardingRequest).filter(
        OffboardingRequest.employee_id == current_user.id
    ).first()
    if not req:
        return None
    return offboarding_to_dict(req)


@router.get("/all")
def get_all_offboarding(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    requests = db.query(OffboardingRequest).order_by(OffboardingRequest.created_at.desc()).all()
    return [offboarding_to_dict(r) for r in requests]


@router.get("/{request_id}")
def get_offboarding(
    request_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(OffboardingRequest).filter(OffboardingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Offboarding request not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return offboarding_to_dict(req)


@router.put("/{request_id}")
def update_offboarding(
    request_id: int,
    data: OffboardingUpdate,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(OffboardingRequest).filter(OffboardingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Offboarding request not found")
    effective_role = get_effective_role(current_user, auth_db)
    is_admin = is_admin_role(effective_role)
    if not is_admin and req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    admin_only = {"hr_comments", "clearance_status"}
    for field, value in data.dict(exclude_none=True).items():
        if field in admin_only and not is_admin:
            continue
        setattr(req, field, value)
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return offboarding_to_dict(req)


@router.put("/{request_id}/checklist/{item_id}")
def toggle_checklist_item(
    request_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    from datetime import datetime
    item = db.query(OffboardingChecklist).filter(
        OffboardingChecklist.id == item_id,
        OffboardingChecklist.offboarding_id == request_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    item.is_completed = not item.is_completed
    item.completed_by = current_user.id if item.is_completed else None
    item.completed_at = datetime.utcnow() if item.is_completed else None
    db.commit()
    return {"id": item.id, "is_completed": item.is_completed}
