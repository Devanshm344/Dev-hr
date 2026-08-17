from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel
from app.db.database import get_db
from app.models.base import Employee, Department
from app.core.security import get_current_user, get_current_admin

router = APIRouter()

class DeptCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    head_id: Optional[int] = None

@router.get("/")
def get_departments(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    depts = db.query(Department).all()
    return [{
        "id": d.id,
        "name": d.name,
        "code": d.code,
        "description": d.description,
        "head_id": d.head_id,
        "head": f"{d.head.first_name} {d.head.last_name}" if d.head else None,
        "employee_count": len(d.employees)
    } for d in depts]

@router.get("/distribution")
def get_department_distribution(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    rows = (
        db.query(Department, func.count(Employee.id).label("emp_count"))
        .outerjoin(Employee, Employee.department_id == Department.id)
        .group_by(Department.id)
        .all()
    )
    total = sum(count for _, count in rows)
    departments = sorted([
        {
            "id": dept.id,
            "name": dept.name,
            "employeeCount": count,
            "percentage": round(count / total * 100, 1) if total > 0 else 0.0,
        }
        for dept, count in rows
    ], key=lambda x: x["employeeCount"], reverse=True)
    return {"totalEmployees": total, "departments": departments}

@router.post("/")
def create_department(data: DeptCreate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    dept = Department(**data.dict())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.put("/{dept_id}")
def update_department(dept_id: int, data: DeptCreate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(dept, k, v)
    db.commit()
    return dept

@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()
    return {"message": "Department deleted"}
