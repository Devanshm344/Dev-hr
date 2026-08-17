from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import shutil, os, uuid
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, Policy, PolicyAssignment, PolicyCategoryEnum, StatusEnum
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role
from app.core.config import settings
from app.services.notifications import create_notification

router = APIRouter()

CATEGORY_LABELS = {
    "policy": "Policy",
    "handbook": "Handbook",
    "sop": "SOP",
    "hr_manual": "HR Manual",
    "other": "Other",
}


def policy_to_dict(p, include_assignments=False):
    d = {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "category": p.category,
        "category_label": CATEGORY_LABELS.get(p.category, p.category),
        "audience": p.audience,
        "file_name": p.file_name,
        "file_size": p.file_size,
        "uploaded_by": p.uploaded_by,
        "uploader_name": (
            f"{p.uploader.first_name} {p.uploader.last_name}" if p.uploader else None
        ),
        "created_at": str(p.created_at) if p.created_at else None,
        "assignment_count": len(p.assignments),
    }
    if include_assignments:
        d["assignments"] = [
            {
                "id": a.id,
                "employee_id": a.employee_id,
                "employee_name": (
                    f"{a.employee.first_name} {a.employee.last_name}" if a.employee else None
                ),
                "employee_initials": (
                    f"{a.employee.first_name[0]}{a.employee.last_name[0]}" if a.employee else None
                ),
                "assigned_by": a.assigned_by,
                "created_at": str(a.created_at) if a.created_at else None,
            }
            for a in p.assignments
        ]
    return d


class AssignPolicyRequest(BaseModel):
    employee_id: int


@router.get("/stats")
def get_policy_stats(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    total = db.query(Policy).count()
    all_audience = db.query(Policy).filter(Policy.audience == "all").count()
    specific = db.query(Policy).filter(Policy.audience == "specific").count()
    by_category = {cat.value: db.query(Policy).filter(Policy.category == cat.value).count()
                   for cat in PolicyCategoryEnum}
    return {
        "total": total,
        "all_employees": all_audience,
        "specific": specific,
        "by_category": by_category,
    }


@router.get("/")
def list_policies(
    category: Optional[str] = None,
    audience: Optional[str] = None,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    query = db.query(Policy)
    if not is_admin_role(get_effective_role(current_user, auth_db)):
        assigned_ids = [
            a.policy_id for a in db.query(PolicyAssignment)
            .filter(PolicyAssignment.employee_id == current_user.id).all()
        ]
        query = query.filter(
            (Policy.audience == "all") | (Policy.id.in_(assigned_ids))
        )
    if category:
        query = query.filter(Policy.category == category)
    if audience:
        query = query.filter(Policy.audience == audience)
    return [policy_to_dict(p) for p in query.order_by(Policy.created_at.desc()).all()]


@router.post("/")
async def upload_policy(
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("policy"),
    audience: str = Form("all"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    upload_dir = Path(settings.UPLOAD_DIR) / "policies"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix
    file_path = upload_dir / f"{uuid.uuid4()}{ext}"
    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)
    policy = Policy(
        title=title,
        description=description or None,
        category=category,
        audience=audience,
        file_path=str(file_path),
        file_name=file.filename,
        file_size=os.path.getsize(file_path),
        uploaded_by=current_user.id,
    )
    db.add(policy)
    db.flush()  # assigns policy.id before any notification links to it

    if audience == "all":
        recipient_ids = [
            row[0] for row in db.query(Employee.id)
            .filter(Employee.status == StatusEnum.active, Employee.id != current_user.id)
            .all()
        ]
        for employee_id in recipient_ids:
            create_notification(
                db, user_id=employee_id, type="policy_published",
                title=f"New {CATEGORY_LABELS.get(category, category).lower()} published",
                body=title,
                link="/my-policy",
            )

    db.commit()
    db.refresh(policy)
    return policy_to_dict(policy)


@router.get("/{policy_id}/download")
def download_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    if not policy.file_path or not Path(policy.file_path).exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    return FileResponse(
        path=policy.file_path,
        filename=policy.file_name,
        media_type="application/octet-stream",
    )


@router.get("/{policy_id}")
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy_to_dict(policy, include_assignments=True)


@router.post("/{policy_id}/assign")
def assign_policy(
    policy_id: int,
    data: AssignPolicyRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    existing = db.query(PolicyAssignment).filter(
        PolicyAssignment.policy_id == policy_id,
        PolicyAssignment.employee_id == data.employee_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Policy already assigned to this employee")
    db.add(PolicyAssignment(
        policy_id=policy_id,
        employee_id=data.employee_id,
        assigned_by=current_user.id,
    ))
    db.commit()
    create_notification(
        db, user_id=data.employee_id, type="policy_published",
        title=f"A {CATEGORY_LABELS.get(policy.category, policy.category).lower()} has been assigned to you",
        body=policy.title,
        link="/my-policy",
    )
    db.commit()
    db.refresh(policy)
    return policy_to_dict(policy, include_assignments=True)


@router.delete("/{policy_id}/unassign/{employee_id}")
def unassign_policy(
    policy_id: int,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    assignment = db.query(PolicyAssignment).filter(
        PolicyAssignment.policy_id == policy_id,
        PolicyAssignment.employee_id == employee_id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"message": "Assignment removed"}


@router.delete("/{policy_id}")
def delete_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    if policy.file_path and Path(policy.file_path).exists():
        os.remove(policy.file_path)
    db.delete(policy)
    db.commit()
    return {"message": "Policy deleted successfully"}
