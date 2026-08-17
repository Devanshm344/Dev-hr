from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import date
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, TravelRequest, TravelRequestStatusEnum
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role

router = APIRouter()


class TravelRequestCreate(BaseModel):
    destination: str
    purpose: str
    departure_date: date
    return_date: date
    travel_mode: Optional[str] = None
    accommodation_required: bool = False
    estimated_budget: float = 0
    notes: Optional[str] = None


class TravelRequestUpdate(BaseModel):
    destination: Optional[str] = None
    purpose: Optional[str] = None
    departure_date: Optional[date] = None
    return_date: Optional[date] = None
    travel_mode: Optional[str] = None
    accommodation_required: Optional[bool] = None
    estimated_budget: Optional[float] = None
    notes: Optional[str] = None


class TravelApproval(BaseModel):
    status: str  # approved / rejected
    rejection_reason: Optional[str] = None


def travel_to_dict(t: TravelRequest):
    return {
        "id": t.id,
        "employee_id": t.employee_id,
        "employee_name": f"{t.employee.first_name} {t.employee.last_name}" if t.employee else None,
        "destination": t.destination,
        "purpose": t.purpose,
        "departure_date": str(t.departure_date),
        "return_date": str(t.return_date),
        "travel_mode": t.travel_mode,
        "accommodation_required": t.accommodation_required,
        "estimated_budget": t.estimated_budget,
        "status": t.status.value if t.status else "pending",
        "approved_by": t.approved_by,
        "approver": f"{t.approver.first_name} {t.approver.last_name}" if t.approver else None,
        "approved_at": str(t.approved_at) if t.approved_at else None,
        "rejection_reason": t.rejection_reason,
        "notes": t.notes,
        "created_at": str(t.created_at) if t.created_at else None,
        "updated_at": str(t.updated_at) if t.updated_at else None,
    }


@router.post("/")
def create_travel_request(
    data: TravelRequestCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = TravelRequest(
        **data.dict(),
        employee_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return travel_to_dict(req)


@router.get("/my")
def get_my_travel_requests(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    requests = (
        db.query(TravelRequest)
        .filter(TravelRequest.employee_id == current_user.id)
        .order_by(TravelRequest.created_at.desc())
        .all()
    )
    return [travel_to_dict(r) for r in requests]


@router.get("/all")
def get_all_travel_requests(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    requests = db.query(TravelRequest).order_by(TravelRequest.created_at.desc()).all()
    return [travel_to_dict(r) for r in requests]


@router.get("/{request_id}")
def get_travel_request(
    request_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(TravelRequest).filter(TravelRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Travel request not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return travel_to_dict(req)


@router.put("/{request_id}")
def update_travel_request(
    request_id: int,
    data: TravelRequestUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(TravelRequest).filter(TravelRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Travel request not found")
    if req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if req.status.value not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")
    for field, value in data.dict(exclude_none=True).items():
        setattr(req, field, value)
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return travel_to_dict(req)


@router.delete("/{request_id}")
def cancel_travel_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(TravelRequest).filter(TravelRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Travel request not found")
    if req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if req.status.value not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")
    req.status = TravelRequestStatusEnum.cancelled
    req.updated_by = current_user.id
    db.commit()
    return {"message": "Travel request cancelled"}


@router.put("/{request_id}/approve")
def approve_travel_request(
    request_id: int,
    data: TravelApproval,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    from datetime import datetime
    req = db.query(TravelRequest).filter(TravelRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Travel request not found")
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    req.status = TravelRequestStatusEnum(data.status)
    req.approved_by = current_user.id
    req.approved_at = datetime.utcnow()
    req.rejection_reason = data.rejection_reason
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return travel_to_dict(req)
