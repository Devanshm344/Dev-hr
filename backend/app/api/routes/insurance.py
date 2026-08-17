from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import date
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, InsuranceDetail, InsuranceDependent, InsuranceDependentRelationEnum
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role

router = APIRouter()


class InsuranceDetailCreate(BaseModel):
    policy_number: Optional[str] = None
    provider: Optional[str] = None
    plan_name: Optional[str] = None
    coverage_amount: float = 0
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class InsuranceDetailUpdate(BaseModel):
    policy_number: Optional[str] = None
    provider: Optional[str] = None
    plan_name: Optional[str] = None
    coverage_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class DependentCreate(BaseModel):
    name: str
    relation: str
    date_of_birth: Optional[date] = None


class DependentUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    date_of_birth: Optional[date] = None
    status: Optional[str] = None


def insurance_to_dict(ins: InsuranceDetail):
    return {
        "id": ins.id,
        "employee_id": ins.employee_id,
        "policy_number": ins.policy_number,
        "provider": ins.provider,
        "plan_name": ins.plan_name,
        "coverage_amount": ins.coverage_amount,
        "start_date": str(ins.start_date) if ins.start_date else None,
        "end_date": str(ins.end_date) if ins.end_date else None,
        "is_active": ins.is_active,
        "document_path": ins.document_path,
        "dependents": [
            {
                "id": d.id,
                "name": d.name,
                "relation": d.relation.value if d.relation else None,
                "date_of_birth": str(d.date_of_birth) if d.date_of_birth else None,
                "status": d.status,
            }
            for d in ins.dependents
        ],
        "created_at": str(ins.created_at) if ins.created_at else None,
        "updated_at": str(ins.updated_at) if ins.updated_at else None,
    }


@router.get("/my")
def get_my_insurance(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    ins = db.query(InsuranceDetail).filter(
        InsuranceDetail.employee_id == current_user.id
    ).first()
    if not ins:
        return None
    return insurance_to_dict(ins)


@router.post("/")
def create_insurance_detail(
    data: InsuranceDetailCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    ins = InsuranceDetail(**data.dict(), created_by=current_user.id)
    db.add(ins)
    db.commit()
    db.refresh(ins)
    return insurance_to_dict(ins)


@router.get("/employee/{employee_id}")
def get_employee_insurance(
    employee_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")
    ins = db.query(InsuranceDetail).filter(InsuranceDetail.employee_id == employee_id).first()
    if not ins:
        return None
    return insurance_to_dict(ins)


@router.put("/{insurance_id}")
def update_insurance_detail(
    insurance_id: int,
    data: InsuranceDetailUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    ins = db.query(InsuranceDetail).filter(InsuranceDetail.id == insurance_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance detail not found")
    for field, value in data.dict(exclude_none=True).items():
        setattr(ins, field, value)
    ins.updated_by = current_user.id
    db.commit()
    db.refresh(ins)
    return insurance_to_dict(ins)


@router.get("/{insurance_id}/dependents")
def get_dependents(
    insurance_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    ins = db.query(InsuranceDetail).filter(InsuranceDetail.id == insurance_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance detail not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and ins.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return [
        {
            "id": d.id,
            "name": d.name,
            "relation": d.relation.value if d.relation else None,
            "date_of_birth": str(d.date_of_birth) if d.date_of_birth else None,
            "status": d.status,
        }
        for d in ins.dependents
    ]


@router.post("/{insurance_id}/dependents")
def add_dependent(
    insurance_id: int,
    data: DependentCreate,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    ins = db.query(InsuranceDetail).filter(InsuranceDetail.id == insurance_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance detail not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and ins.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        relation_enum = InsuranceDependentRelationEnum(data.relation)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid relation: {data.relation}")
    dep = InsuranceDependent(
        insurance_id=insurance_id,
        name=data.name,
        relation=relation_enum,
        date_of_birth=data.date_of_birth,
        created_by=current_user.id,
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return {
        "id": dep.id,
        "name": dep.name,
        "relation": dep.relation.value,
        "date_of_birth": str(dep.date_of_birth) if dep.date_of_birth else None,
        "status": dep.status,
    }


@router.put("/{insurance_id}/dependents/{dependent_id}")
def update_dependent(
    insurance_id: int,
    dependent_id: int,
    data: DependentUpdate,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    ins = db.query(InsuranceDetail).filter(InsuranceDetail.id == insurance_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance detail not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and ins.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    dep = db.query(InsuranceDependent).filter(
        InsuranceDependent.id == dependent_id,
        InsuranceDependent.insurance_id == insurance_id,
    ).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependent not found")
    update_data = data.dict(exclude_none=True)
    if "relation" in update_data:
        try:
            update_data["relation"] = InsuranceDependentRelationEnum(update_data["relation"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid relation")
    for field, value in update_data.items():
        setattr(dep, field, value)
    dep.updated_by = current_user.id
    db.commit()
    db.refresh(dep)
    return {
        "id": dep.id,
        "name": dep.name,
        "relation": dep.relation.value,
        "date_of_birth": str(dep.date_of_birth) if dep.date_of_birth else None,
        "status": dep.status,
    }
