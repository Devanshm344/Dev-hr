from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field
from datetime import date
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, Payslip
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role
from app.services.leave_calculation import calculate_lop_amount
from app.services.notifications import create_notification

router = APIRouter()

_MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

def _month_name(month: int) -> str:
    return _MONTH_NAMES[month] if 1 <= month <= 12 else str(month)

class PayslipGenerate(BaseModel):
    employee_id: int
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    working_days: int = Field(default=26, ge=1, le=31)
    present_days: int = Field(default=26, ge=0, le=31)
    lop_days: float = Field(default=0, ge=0)
    other_deductions: float = Field(default=0, ge=0)

def calc_payslip(employee: Employee, data: PayslipGenerate) -> dict:
    basic = employee.base_salary * 0.40
    hra = employee.base_salary * 0.20
    special = employee.base_salary * 0.20
    transport = 1600
    medical = 1250
    gross = basic + hra + special + transport + medical

    pf = basic * 0.12
    prof_tax = 200 if gross > 15000 else 0
    tds = max(0, (gross * 12 - 250000) * 0.05 / 12)
    total_deductions = pf + prof_tax + tds + data.other_deductions

    # LOP adjustment
    lop_amount = calculate_lop_amount(gross, data.working_days, data.lop_days)
    net = gross - total_deductions - lop_amount

    return {
        "basic_salary": round(basic, 2),
        "hra": round(hra, 2),
        "special_allowance": round(special, 2),
        "transport_allowance": round(transport, 2),
        "medical_allowance": round(medical, 2),
        "gross_salary": round(gross, 2),
        "pf_deduction": round(pf, 2),
        "professional_tax": round(prof_tax, 2),
        "tds": round(tds, 2),
        "other_deductions": round(data.other_deductions, 2),
        "total_deductions": round(total_deductions, 2),
        "net_salary": round(net, 2),
        "working_days": data.working_days,
        "present_days": data.present_days,
        "lop_days": data.lop_days
    }

def payslip_to_dict(p):
    return {
        "id": p.id,
        "employee_id": p.employee_id,
        "employee_name": f"{p.employee.first_name} {p.employee.last_name}" if p.employee else None,
        "employee_code": p.employee.employee_id if p.employee else None,
        "title": p.employee.title if p.employee else None,
        "department": p.employee.department.name if p.employee and p.employee.department else None,
        "month": p.month,
        "year": p.year,
        "basic_salary": p.basic_salary,
        "hra": p.hra,
        "special_allowance": p.special_allowance,
        "transport_allowance": p.transport_allowance,
        "medical_allowance": p.medical_allowance,
        "gross_salary": p.gross_salary,
        "pf_deduction": p.pf_deduction,
        "professional_tax": p.professional_tax,
        "tds": p.tds,
        "other_deductions": p.other_deductions,
        "total_deductions": p.total_deductions,
        "net_salary": p.net_salary,
        "working_days": p.working_days,
        "present_days": p.present_days,
        "lop_days": p.lop_days,
        "status": p.status,
        "payment_date": str(p.payment_date) if p.payment_date else None,
        "created_at": str(p.created_at) if p.created_at else None,
    }

@router.post("/generate")
def generate_payslip(
    data: PayslipGenerate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    existing = db.query(Payslip).filter(
        Payslip.employee_id == data.employee_id,
        Payslip.month == data.month,
        Payslip.year == data.year
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payslip already exists for this month")
    
    calc = calc_payslip(emp, data)
    payslip = Payslip(
        employee_id=data.employee_id,
        month=data.month,
        year=data.year,
        **calc,
        status="generated"
    )
    db.add(payslip)
    db.commit()
    db.refresh(payslip)
    create_notification(
        db, user_id=emp.id, type="payslip_generated",
        title="Your payslip is ready",
        body=f"{_month_name(data.month)} {data.year} — net salary {payslip.net_salary}",
        link="/payroll",
    )
    db.commit()
    return payslip_to_dict(payslip)

@router.post("/generate-bulk")
def generate_bulk_payslips(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    employees = db.query(Employee).filter(Employee.status == "active").all()
    generated = 0
    skipped = 0
    for emp in employees:
        existing = db.query(Payslip).filter(
            Payslip.employee_id == emp.id,
            Payslip.month == month,
            Payslip.year == year
        ).first()
        if existing:
            skipped += 1
            continue
        
        from types import SimpleNamespace
        data = SimpleNamespace(employee_id=emp.id, month=month, year=year, working_days=26, present_days=26, lop_days=0, other_deductions=0)
        calc = calc_payslip(emp, data)
        payslip = Payslip(employee_id=emp.id, month=month, year=year, **calc, status="generated")
        db.add(payslip)
        create_notification(
            db, user_id=emp.id, type="payslip_generated",
            title="Your payslip is ready",
            body=f"{_month_name(month)} {year} — net salary {calc['net_salary']}",
            link="/payroll",
        )
        generated += 1

    db.commit()
    return {"generated": generated, "skipped": skipped}

@router.get("/my")
def get_my_payslips(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    payslips = db.query(Payslip).filter(
        Payslip.employee_id == current_user.id
    ).order_by(Payslip.year.desc(), Payslip.month.desc()).all()
    return [payslip_to_dict(p) for p in payslips]

@router.get("/all")
def get_all_payslips(
    month: Optional[int] = None,
    year: Optional[int] = None,
    employee_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    query = db.query(Payslip)
    if month:
        query = query.filter(Payslip.month == month)
    if year:
        query = query.filter(Payslip.year == year)
    if employee_id:
        query = query.filter(Payslip.employee_id == employee_id)
    
    total = query.count()
    payslips = query.order_by(Payslip.year.desc(), Payslip.month.desc()).offset(skip).limit(limit).all()
    return {"total": total, "payslips": [payslip_to_dict(p) for p in payslips]}

@router.get("/{payslip_id}")
def get_payslip(
    payslip_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    p = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found")
    if p.employee_id != current_user.id and not is_admin_role(get_effective_role(current_user, auth_db)):
        raise HTTPException(status_code=403, detail="Permission denied")
    return payslip_to_dict(p)

@router.put("/{payslip_id}/mark-paid")
def mark_paid(
    payslip_id: int,
    payment_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    p = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found")
    p.status = "paid"
    p.payment_date = payment_date or date.today()
    db.commit()
    create_notification(
        db, user_id=p.employee_id, type="payslip_paid",
        title="Your salary has been paid",
        body=f"{_month_name(p.month)} {p.year} — net salary {p.net_salary}, paid {p.payment_date}",
        link="/payroll",
    )
    db.commit()
    return payslip_to_dict(p)
