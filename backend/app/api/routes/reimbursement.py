from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field
from datetime import date
import os, uuid, shutil
from pathlib import Path
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, ReimbursementRequest, ReimbursementStatusEnum, ReimbursementDocument
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role
from app.core.config import settings

router = APIRouter()

REIMBURSEMENT_CATEGORIES = [
    "Travel", "Accommodation", "Meals", "Communication",
    "Training", "Medical", "Office Supplies", "Other",
]


class ReimbursementCreate(BaseModel):
    category: str
    description: str
    amount: float = Field(gt=0)
    expense_date: date


class ReimbursementUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    expense_date: Optional[date] = None


class ReimbursementApproval(BaseModel):
    status: str  # approved / rejected
    rejection_reason: Optional[str] = None


def reimb_to_dict(r: ReimbursementRequest):
    return {
        "id": r.id,
        "employee_id": r.employee_id,
        "employee_name": f"{r.employee.first_name} {r.employee.last_name}" if r.employee else None,
        "category": r.category,
        "description": r.description,
        "amount": r.amount,
        "expense_date": str(r.expense_date),
        "status": r.status.value if r.status else "pending",
        "approved_by": r.approved_by,
        "approver": f"{r.approver.first_name} {r.approver.last_name}" if r.approver else None,
        "approved_at": str(r.approved_at) if r.approved_at else None,
        "rejection_reason": r.rejection_reason,
        "payment_date": str(r.payment_date) if r.payment_date else None,
        "documents": [
            {"id": d.id, "file_name": d.file_name, "file_size": d.file_size}
            for d in r.documents
        ],
        "created_at": str(r.created_at) if r.created_at else None,
        "updated_at": str(r.updated_at) if r.updated_at else None,
    }


@router.get("/categories")
def get_categories():
    return REIMBURSEMENT_CATEGORIES


@router.post("/")
def create_reimbursement(
    data: ReimbursementCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = ReimbursementRequest(
        **data.dict(),
        employee_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return reimb_to_dict(req)


@router.get("/my")
def get_my_reimbursements(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    requests = (
        db.query(ReimbursementRequest)
        .filter(ReimbursementRequest.employee_id == current_user.id)
        .order_by(ReimbursementRequest.created_at.desc())
        .all()
    )
    return [reimb_to_dict(r) for r in requests]


@router.get("/all")
def get_all_reimbursements(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    requests = db.query(ReimbursementRequest).order_by(ReimbursementRequest.created_at.desc()).all()
    return [reimb_to_dict(r) for r in requests]


@router.get("/{request_id}")
def get_reimbursement(
    request_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(ReimbursementRequest).filter(ReimbursementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Reimbursement request not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return reimb_to_dict(req)


@router.put("/{request_id}")
def update_reimbursement(
    request_id: int,
    data: ReimbursementUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(ReimbursementRequest).filter(ReimbursementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Reimbursement request not found")
    if req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if req.status.value not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")
    for field, value in data.dict(exclude_none=True).items():
        setattr(req, field, value)
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return reimb_to_dict(req)


@router.put("/{request_id}/approve")
def approve_reimbursement(
    request_id: int,
    data: ReimbursementApproval,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    from datetime import datetime
    req = db.query(ReimbursementRequest).filter(ReimbursementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Reimbursement request not found")
    if req.employee_id == current_user.id:
        raise HTTPException(status_code=403, detail="You cannot approve or reject your own reimbursement request")
    if req.status.value != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be approved or rejected")
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    req.status = ReimbursementStatusEnum(data.status)
    req.approved_by = current_user.id
    req.approved_at = datetime.utcnow()
    req.rejection_reason = data.rejection_reason
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return reimb_to_dict(req)


@router.put("/{request_id}/mark-paid")
def mark_reimbursement_paid(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    req = db.query(ReimbursementRequest).filter(ReimbursementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Reimbursement request not found")
    if req.status.value != "approved":
        raise HTTPException(status_code=400, detail="Only approved requests can be marked as paid")
    req.status = ReimbursementStatusEnum.paid
    req.payment_date = date.today()
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return reimb_to_dict(req)


@router.post("/{request_id}/documents")
async def upload_reimbursement_document(
    request_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(ReimbursementRequest).filter(ReimbursementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Reimbursement request not found")
    if req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    upload_dir = Path(settings.UPLOAD_DIR) / "reimbursements" / str(request_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix
    file_path = upload_dir / f"{uuid.uuid4()}{ext}"
    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    doc = ReimbursementDocument(
        reimbursement_id=request_id,
        file_path=str(file_path),
        file_name=file.filename,
        file_size=os.path.getsize(file_path),
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "file_name": doc.file_name, "file_size": doc.file_size}


@router.delete("/{request_id}/documents/{doc_id}")
def delete_reimbursement_document(
    request_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(ReimbursementRequest).filter(ReimbursementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Reimbursement request not found")
    if req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    doc = db.query(ReimbursementDocument).filter(
        ReimbursementDocument.id == doc_id, ReimbursementDocument.reimbursement_id == request_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}
