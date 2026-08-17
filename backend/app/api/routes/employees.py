from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_, text, func
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr
from datetime import date
from pathlib import Path
import uuid
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, Department, User
from app.core.security import get_current_user, get_current_admin, get_password_hash, get_effective_role, set_system_role, is_admin_role
from app.core.config import settings

_PHOTO_ALLOWED_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
_PHOTO_MAX_SIZE = 5 * 1024 * 1024  # 5 MB

router = APIRouter()

class EmployeeCreate(BaseModel):
    employee_id: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    mobile_phone: Optional[str] = None
    personal_email: Optional[str] = None
    work_phone: Optional[str] = None
    password: Optional[str] = None
    system_role: Literal["Employee", "Admin", "Super Admin"] = "Employee"
    job_role: Optional[str] = None
    job_level: Optional[str] = None
    employment_type: Optional[str] = "Permanent"
    source_of_hire: Optional[str] = None
    department_id: Optional[int] = None
    sub_department: Optional[str] = None
    manager_id: Optional[int] = None
    title: Optional[str] = None
    work_location: Optional[str] = None
    date_of_joining: Optional[date] = None
    date_of_birth: Optional[date] = None
    probation_end_date: Optional[date] = None
    gender: Optional[str] = None
    about_me: Optional[str] = None
    marital_status: Optional[str] = None
    father_name: Optional[str] = None
    blood_group: Optional[str] = None
    present_address: Optional[str] = None
    permanent_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    pincode: Optional[str] = None
    emergency_contact_primary_name: Optional[str] = None
    emergency_contact_primary_number: Optional[str] = None
    emergency_contact_secondary_name: Optional[str] = None
    emergency_contact_secondary_number: Optional[str] = None
    primary_skill_set: Optional[str] = None
    secondary_skill_set: Optional[str] = None
    other_skills: Optional[str] = None
    total_experience: Optional[str] = None
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None
    passport_number: Optional[str] = None
    passport_valid_from: Optional[date] = None
    passport_valid_to: Optional[date] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_account_holder_name: Optional[str] = None
    base_salary: float = 0

def generate_temp_password() -> str:
    """A unique, unguessable per-employee temp password — used whenever an
    admin creates an employee without setting one explicitly, instead of the
    single shared default every such employee used to get."""
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))

class EmployeeUpdate(BaseModel):
    employee_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile_phone: Optional[str] = None
    work_phone: Optional[str] = None
    title: Optional[str] = None
    job_role: Optional[str] = None
    job_level: Optional[str] = None
    employment_type: Optional[str] = None
    department_id: Optional[int] = None
    sub_department: Optional[str] = None
    manager_id: Optional[int] = None
    status: Optional[str] = None
    work_location: Optional[str] = None
    source_of_hire: Optional[str] = None
    present_address: Optional[str] = None
    permanent_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    base_salary: Optional[float] = None
    probation_end_date: Optional[date] = None
    date_of_joining: Optional[date] = None
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_account_holder_name: Optional[str] = None
    blood_group: Optional[str] = None
    marital_status: Optional[str] = None
    father_name: Optional[str] = None
    about_me: Optional[str] = None
    personal_email: Optional[str] = None
    primary_skill_set: Optional[str] = None
    secondary_skill_set: Optional[str] = None
    other_skills: Optional[str] = None
    total_experience: Optional[str] = None
    current_project: Optional[str] = None
    passport_number: Optional[str] = None
    passport_valid_from: Optional[date] = None
    passport_valid_to: Optional[date] = None
    gender: Optional[str] = None

def check_circular_hierarchy(db: Session, employee_id: int, proposed_manager_id: int) -> bool:
    """Returns True if assigning proposed_manager_id to employee_id would create a cycle."""
    visited = set()
    current_id = proposed_manager_id
    while current_id is not None:
        if current_id == employee_id:
            return True
        if current_id in visited:
            break
        visited.add(current_id)
        mgr = db.query(Employee).filter(Employee.id == current_id).first()
        if mgr is None:
            break
        current_id = mgr.manager_id
    return False


def employee_to_dict(emp, system_role=None, full: bool = True):
    """`full=False` returns only safe, directory-style fields — no contact
    info, address, DOB, emergency contacts, skills, salary, or identity/bank
    documents. Used wherever this list is reachable by non-admin callers
    (Assets, Policy, Performance pages all call GET /employees/ and are not
    admin-gated) so a regular employee can never pull another employee's
    salary or bank details through this endpoint."""
    safe = {
        "id": emp.id,
        "employee_id": emp.employee_id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "name": f"{emp.first_name} {emp.last_name}",
        "email": emp.email,
        "role": system_role,
        "job_role": emp.job_role,
        "employment_type": emp.employment_type,
        "status": emp.status,
        "department_id": emp.department_id,
        "department": emp.department.name if emp.department else None,
        "sub_department": emp.sub_department,
        "manager_id": emp.manager_id,
        "manager": f"{emp.manager.first_name} {emp.manager.last_name}" if emp.manager else None,
        "reporting_manager_name": emp.reporting_manager_name,
        "title": emp.title,
        "job_level": emp.job_level,
        "work_location": emp.work_location,
        "date_of_joining": str(emp.date_of_joining) if emp.date_of_joining else None,
        "profile_picture": emp.profile_picture,
    }
    if not full:
        return safe

    return {
        **safe,
        "mobile_phone": emp.mobile_phone,
        "personal_email": emp.personal_email,
        "work_phone": emp.work_phone,
        "onboarding_status": emp.onboarding_status,
        "date_of_birth": str(emp.date_of_birth) if emp.date_of_birth else None,
        "date_of_exit": str(emp.date_of_exit) if emp.date_of_exit else None,
        "last_working_day": str(emp.last_working_day) if emp.last_working_day else None,
        "gender": emp.gender,
        "blood_group": emp.blood_group,
        "marital_status": emp.marital_status,
        "father_name": emp.father_name,
        "present_address": emp.present_address,
        "permanent_address": emp.permanent_address,
        "city": emp.city,
        "state": emp.state,
        "country": emp.country,
        "pincode": emp.pincode,
        "emergency_contact_primary_name": emp.emergency_contact_primary_name,
        "emergency_contact_primary_number": emp.emergency_contact_primary_number,
        "emergency_contact_secondary_name": emp.emergency_contact_secondary_name,
        "emergency_contact_secondary_number": emp.emergency_contact_secondary_number,
        "primary_skill_set": emp.primary_skill_set,
        "secondary_skill_set": emp.secondary_skill_set,
        "other_skills": emp.other_skills,
        "total_experience": emp.total_experience,
        "current_project": emp.current_project,
        "base_salary": emp.base_salary,
        "about_me": emp.about_me,
        "source_of_hire": emp.source_of_hire,
        "pan_number": emp.pan_number,
        "aadhar_number": emp.aadhar_number,
        "bank_account_number": emp.bank_account_number,
        "bank_name": emp.bank_name,
        "ifsc_code": emp.ifsc_code,
        "bank_account_holder_name": emp.bank_account_holder_name,
        "passport_number": emp.passport_number,
        "passport_valid_from": str(emp.passport_valid_from) if emp.passport_valid_from else None,
        "passport_valid_to": str(emp.passport_valid_to) if emp.passport_valid_to else None,
        "probation_end_date": str(emp.probation_end_date) if emp.probation_end_date else None,
        "created_at": str(emp.created_at) if emp.created_at else None,
    }

def generate_employee_id(db: Session) -> str:
    count = db.query(Employee).count()
    return f"CTL-{str(count + 1).zfill(4)}"


def trend(delta, label, sparkline):
    """Shared KPI-card trend shape: delta + direction + trailing sparkline.
    Reused by /employees/stats and /user-management/kpis so both KPI rows
    are computed the same way.
    """
    return {
        "delta": delta,
        "direction": "up" if delta > 0 else "down" if delta < 0 else "neutral",
        "label": label,
        "sparkline": sparkline,
    }

@router.get("/")
def get_employees(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user)
):
    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    query = db.query(Employee)
    if search:
        query = query.filter(
            or_(
                Employee.first_name.ilike(f"%{search}%"),
                Employee.last_name.ilike(f"%{search}%"),
                Employee.email.ilike(f"%{search}%"),
                Employee.employee_id.ilike(f"%{search}%"),
                Employee.title.ilike(f"%{search}%"),
            )
        )
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    if status:
        query = query.filter(Employee.status == status)
    
    total = query.count()
    employees = query.order_by(Employee.first_name, Employee.last_name).offset(skip).limit(limit).all()

    from app.models.base import UserRole
    emp_ids = [e.employee_id for e in employees if e.employee_id]
    role_map = {
        ur.employee_id: ur.system_role
        for ur in db.query(UserRole).filter(UserRole.employee_id.in_(emp_ids)).all()
    } if emp_ids else {}

    return {
        "total": total,
        "employees": [
            employee_to_dict(e, role_map.get(e.employee_id, "Employee"), full=is_admin or e.id == current_user.id)
            for e in employees
        ]
    }

@router.post("/")
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    normalized_email = data.email.lower().strip()
    existing = db.query(Employee).filter(func.lower(Employee.email) == normalized_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Resolve Employee ID: use provided value or auto-generate
    provided_eid = (data.employee_id or "").strip()
    if provided_eid:
        if db.query(Employee).filter(Employee.employee_id == provided_eid).first():
            raise HTTPException(status_code=400, detail=f"Employee ID '{provided_eid}' is already in use")
        resolved_employee_id = provided_eid
    else:
        resolved_employee_id = generate_employee_id(db)

    reporting_manager_name = None
    if data.manager_id:
        mgr = db.query(Employee).filter(Employee.id == data.manager_id).first()
        if mgr:
            reporting_manager_name = f"{mgr.first_name} {mgr.last_name}"

    temp_password = data.password or generate_temp_password()

    emp = Employee(
        employee_id=resolved_employee_id,
        first_name=data.first_name,
        last_name=data.last_name,
        email=normalized_email,
        mobile_phone=data.mobile_phone,
        personal_email=data.personal_email,
        work_phone=data.work_phone,
        hashed_password=get_password_hash(temp_password),
        job_role=data.job_role,
        job_level=data.job_level,
        employment_type=data.employment_type,
        source_of_hire=data.source_of_hire,
        department_id=data.department_id,
        sub_department=data.sub_department,
        manager_id=data.manager_id,
        reporting_manager_name=reporting_manager_name,
        title=data.title,
        work_location=data.work_location,
        date_of_joining=data.date_of_joining,
        date_of_birth=data.date_of_birth,
        probation_end_date=data.probation_end_date,
        gender=data.gender,
        about_me=data.about_me,
        marital_status=data.marital_status,
        father_name=data.father_name,
        blood_group=data.blood_group,
        present_address=data.present_address,
        permanent_address=data.permanent_address,
        city=data.city,
        state=data.state,
        country=data.country,
        pincode=data.pincode,
        emergency_contact_primary_name=data.emergency_contact_primary_name,
        emergency_contact_primary_number=data.emergency_contact_primary_number,
        emergency_contact_secondary_name=data.emergency_contact_secondary_name,
        emergency_contact_secondary_number=data.emergency_contact_secondary_number,
        primary_skill_set=data.primary_skill_set,
        secondary_skill_set=data.secondary_skill_set,
        other_skills=data.other_skills,
        total_experience=data.total_experience,
        pan_number=data.pan_number,
        aadhar_number=data.aadhar_number,
        passport_number=data.passport_number,
        passport_valid_from=data.passport_valid_from,
        passport_valid_to=data.passport_valid_to,
        bank_name=data.bank_name,
        bank_account_number=data.bank_account_number,
        ifsc_code=data.ifsc_code,
        bank_account_holder_name=data.bank_account_holder_name,
        base_salary=data.base_salary,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    # Always create the user_roles row alongside the employee — even for the
    # default 'Employee' tier — so employees and user_roles stay 1:1 from the
    # moment of creation, with no employee ever left implicit/unlisted.
    set_system_role(db, emp, data.system_role)

    # Auth-adjacent metadata row (is_active/last_login) — no role here, that's
    # exclusively in user_roles. One per employee, kept 1:1 from creation.
    db.add(User(
        emp_id=emp.id,
        employee_id=emp.employee_id,
        full_name=f"{emp.first_name} {emp.last_name}",
        email=emp.email,
        is_active=(emp.status != "terminated"),
    ))
    db.commit()

    return {**employee_to_dict(emp, get_effective_role(emp, db)), "temp_password": temp_password}

@router.get("/managers")
def get_managers_list(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    employees = (
        db.query(Employee)
        .filter(Employee.status.in_(["active", "on_leave"]))
        .order_by(Employee.first_name, Employee.last_name)
        .all()
    )
    return [
        {
            "id": e.id,
            "employee_id": e.employee_id,
            "full_name": f"{e.first_name} {e.last_name}",
            "designation": e.title or e.job_role or ""
        }
        for e in employees
    ]


@router.get("/stats")
def get_employee_stats(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    from datetime import timedelta
    from sqlalchemy import func as sa_func
    from app.models.base import Attendance, LeaveRequest

    today = date.today()
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]  # last 7 days, oldest -> today
    yesterday = days[-2]
    month_start = today.replace(day=1)
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    total = db.query(Employee).count()

    # -- Active today: distinct employees with a check-in, grouped over the trailing window --
    att_rows = (
        db.query(Attendance.date, sa_func.count(sa_func.distinct(Attendance.employee_id)))
        .filter(Attendance.date >= days[0], Attendance.date <= today, Attendance.check_in.isnot(None))
        .group_by(Attendance.date)
        .all()
    )
    att_counts = dict(att_rows)
    active_sparkline = [att_counts.get(d, 0) for d in days]
    active = att_counts.get(today, 0)
    active_yesterday = att_counts.get(yesterday, 0)

    # -- On leave: approved leave requests overlapping each day of the trailing window --
    overlapping = (
        db.query(LeaveRequest.start_date, LeaveRequest.end_date)
        .filter(
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= days[0],
        )
        .all()
    )
    on_leave_sparkline = [sum(1 for s, e in overlapping if s <= d <= e) for d in days]
    on_leave = on_leave_sparkline[-1]
    on_leave_yesterday = on_leave_sparkline[-2]

    # -- New hires: grouped by date_of_joining, cumulative total growth over the window --
    hire_rows = (
        db.query(Employee.date_of_joining, sa_func.count(Employee.id))
        .filter(Employee.date_of_joining >= days[0], Employee.date_of_joining <= today)
        .group_by(Employee.date_of_joining)
        .all()
    )
    hire_counts = dict(hire_rows)
    running_total = db.query(Employee).filter(Employee.date_of_joining < days[0]).count()
    total_sparkline, new_hire_sparkline = [], []
    for d in days:
        c = hire_counts.get(d, 0)
        running_total += c
        total_sparkline.append(running_total)
        new_hire_sparkline.append(c)

    new_this_month = db.query(Employee).filter(
        Employee.date_of_joining >= month_start, Employee.date_of_joining <= today
    ).count()
    new_last_month = db.query(Employee).filter(
        Employee.date_of_joining >= prev_month_start, Employee.date_of_joining <= prev_month_end
    ).count()

    return {
        "total": total,
        "active": active,
        "on_leave": on_leave,
        "new_this_month": new_this_month,
        "trends": {
            "total": trend(new_this_month, "this month", total_sparkline),
            "active": trend(active - active_yesterday, "vs yesterday", active_sparkline),
            "on_leave": trend(on_leave - on_leave_yesterday, "vs yesterday", on_leave_sparkline),
            "new_this_month": trend(new_this_month - new_last_month, "vs last month", new_hire_sparkline),
        },
    }


@router.get("/birthdays")
def get_upcoming_birthdays(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    from sqlalchemy import extract
    today = date.today()
    current_month = today.month
    current_day = today.day
    next_month = (today.month % 12) + 1

    base = [Employee.date_of_birth.isnot(None), Employee.status != "terminated"]

    # Birthdays strictly after today in the current month
    remaining = (
        db.query(Employee)
        .filter(
            *base,
            extract("month", Employee.date_of_birth) == current_month,
            extract("day", Employee.date_of_birth) > current_day,
        )
        .order_by(extract("day", Employee.date_of_birth))
        .all()
    )

    # Fall back to next month if nothing remains in current month
    if not remaining:
        remaining = (
            db.query(Employee)
            .filter(
                *base,
                extract("month", Employee.date_of_birth) == next_month,
            )
            .order_by(extract("day", Employee.date_of_birth))
            .all()
        )

    return [
        {
            "id": emp.id,
            "full_name": f"{emp.first_name} {emp.last_name}",
            "title": emp.title or emp.job_role,
            "department": emp.department.name if emp.department else None,
            "date_of_birth": str(emp.date_of_birth),
            "profile_picture": emp.profile_picture,
        }
        for emp in remaining
    ]

@router.post("/{employee_id}/photo")
async def upload_employee_photo(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    if not is_admin and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Permission denied")

    ext = Path(file.filename).suffix.lower()
    if ext not in _PHOTO_ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG, and WEBP images are allowed")

    content = await file.read()
    if len(content) > _PHOTO_MAX_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5 MB limit")

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.profile_picture:
        old_path = Path(emp.profile_picture.lstrip('/'))
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    upload_dir = Path(settings.UPLOAD_DIR) / str(employee_id) / "photos"
    upload_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / unique_name

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    photo_url = f"/uploads/{employee_id}/photos/{unique_name}"
    emp.profile_picture = photo_url
    db.commit()
    return {"profile_picture": photo_url}


@router.delete("/{employee_id}/photo")
def remove_employee_photo(
    employee_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    if not is_admin and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Permission denied")

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.profile_picture:
        old_path = Path(emp.profile_picture.lstrip('/'))
        if old_path.exists():
            old_path.unlink(missing_ok=True)
        emp.profile_picture = None
        db.commit()

    return {"message": "Profile photo removed"}


@router.get("/{employee_id}")
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    is_full = is_admin_role(get_effective_role(current_user, auth_db)) or current_user.id == employee_id
    return employee_to_dict(emp, get_effective_role(emp, db), full=is_full)

@router.put("/{employee_id}")
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Admin-only: unlike employee_profile.py's PUT (which field-gates a
    # self-edit), this legacy endpoint accepts every field including salary,
    # bank details, and status with no per-field restriction, so self-edit
    # must not be allowed here at all — the UI never calls this route for
    # self-service anyway (it uses employee_profile.py for that).
    if not is_admin_role(get_effective_role(current_user, auth_db)):
        raise HTTPException(status_code=403, detail="Admin access required")

    update_data = data.dict(exclude_unset=True)

    if "employee_id" in update_data:
        new_eid = (update_data["employee_id"] or "").strip()
        if new_eid and new_eid != emp.employee_id:
            if db.query(Employee).filter(Employee.employee_id == new_eid, Employee.id != employee_id).first():
                raise HTTPException(status_code=400, detail=f"Employee ID '{new_eid}' is already in use")
        update_data["employee_id"] = new_eid or emp.employee_id

    if "manager_id" in update_data:
        new_manager_id = update_data["manager_id"]
        if new_manager_id and new_manager_id == employee_id:
            raise HTTPException(status_code=400, detail="Employee cannot be their own manager")
        if new_manager_id and check_circular_hierarchy(db, employee_id, new_manager_id):
            raise HTTPException(status_code=400, detail="Cannot assign manager: circular hierarchy detected")
        if new_manager_id:
            mgr = db.query(Employee).filter(Employee.id == new_manager_id).first()
            update_data["reporting_manager_name"] = f"{mgr.first_name} {mgr.last_name}" if mgr else None
        else:
            update_data["reporting_manager_name"] = None

    for key, value in update_data.items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return employee_to_dict(emp, get_effective_role(emp, db))

def _hard_delete_employee(db: Session, employee_id: int) -> None:
    """Irreversibly deletes an employee and cascades deletes/nulls across every
    related table. Shared by the single-employee endpoint below and User
    Management's bulk-delete endpoint — one cascade implementation, not two.
    Raises HTTPException (404 not found, 500 on failure) either way."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    eid = employee_id
    emp_str_id = emp.employee_id  # string ID like "CTL-0179"

    # Cache of actual DB columns per table to handle model/migration drift
    _col_cache: dict = {}

    def _cols(table: str) -> set:
        if table not in _col_cache:
            rows = db.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = :t"
            ), {"t": table}).fetchall()
            _col_cache[table] = {r[0] for r in rows}
        return _col_cache[table]

    def set_null(table: str, *cols: str) -> None:
        """SET NULL only on columns that actually exist in the DB table."""
        existing = [c for c in cols if c in _cols(table)]
        if not existing:
            return
        set_clause = ", ".join(f"{c} = NULL" for c in existing)
        where_clause = " OR ".join(f"{c} = :eid" for c in existing)
        db.execute(text(f"UPDATE {table} SET {set_clause} WHERE {where_clause}"), {"eid": eid})

    try:
        # ── Step 1: SET NULL on nullable FK columns (only if column exists in DB) ──
        set_null("employees", "manager_id")
        set_null("departments", "head_id")
        set_null("announcements", "published_by")
        set_null("assets", "current_employee_id")
        set_null("asset_assignments", "employee_id", "performed_by")
        set_null("shifts", "created_by")
        set_null("employee_shift_mappings", "assigned_by")
        set_null("shift_swap_requests", "approved_by")
        set_null("policies", "uploaded_by")
        set_null("policy_assignments", "assigned_by")
        set_null("leave_requests", "approved_by")
        set_null("documents", "uploaded_by")
        set_null("travel_requests", "approved_by", "created_by", "updated_by")
        set_null("reimbursement_requests", "approved_by", "created_by", "updated_by")
        set_null("offboarding_requests", "created_by", "updated_by", "approved_by")
        set_null("leave_enablement_requests", "reviewed_by")
        set_null("offboarding_checklists", "completed_by")
        set_null("insurance_details", "created_by", "updated_by")
        set_null("insurance_dependents", "created_by", "updated_by")
        set_null("asset_requisitions", "approved_by", "created_by", "updated_by")
        set_null("holidays", "created_by")
        set_null("asset_tickets", "created_by", "updated_by")
        set_null("ar_attachments", "uploaded_by")
        set_null("ar_status_history", "changed_by")
        set_null("user_activity_log", "actor_id")
        set_null("leave_transactions", "performed_by")

        # ── Step 2: DELETE owned records — deepest children first ──────────────
        db.execute(text("""
            DELETE FROM ar_attachments
            WHERE ticket_id IN (SELECT id FROM asset_tickets WHERE employee_id = :eid)
        """), {"eid": eid})
        db.execute(text("""
            DELETE FROM ar_status_history
            WHERE ticket_id IN (SELECT id FROM asset_tickets WHERE employee_id = :eid)
        """), {"eid": eid})
        db.execute(text("DELETE FROM asset_tickets WHERE employee_id = :eid"), {"eid": eid})

        db.execute(text("""
            DELETE FROM reimbursement_documents
            WHERE reimbursement_id IN (SELECT id FROM reimbursement_requests WHERE employee_id = :eid)
        """), {"eid": eid})
        db.execute(text("DELETE FROM reimbursement_requests WHERE employee_id = :eid"), {"eid": eid})

        db.execute(text("""
            DELETE FROM offboarding_checklists
            WHERE offboarding_id IN (SELECT id FROM offboarding_requests WHERE employee_id = :eid)
        """), {"eid": eid})
        db.execute(text("DELETE FROM offboarding_requests WHERE employee_id = :eid"), {"eid": eid})

        db.execute(text("""
            DELETE FROM insurance_dependents
            WHERE insurance_id IN (SELECT id FROM insurance_details WHERE employee_id = :eid)
        """), {"eid": eid})
        db.execute(text("DELETE FROM insurance_details WHERE employee_id = :eid"), {"eid": eid})

        db.execute(text("DELETE FROM attendance WHERE employee_id = :eid"), {"eid": eid})
        if emp_str_id:
            # leave_transactions.leave_request_id references leave_requests, so it
            # must be cleared before leave_requests rows are deleted below.
            db.execute(text("DELETE FROM leave_transactions WHERE employee_id = :str_id"), {"str_id": emp_str_id})
            db.execute(text("DELETE FROM leave_balances WHERE employee_id = :str_id"), {"str_id": emp_str_id})
            db.execute(text("DELETE FROM leave_requests WHERE employee_id = :str_id"), {"str_id": emp_str_id})
        db.execute(text("DELETE FROM payslips WHERE employee_id = :eid"), {"eid": eid})
        db.execute(text("""
            DELETE FROM performance_reviews
            WHERE employee_id = :eid OR reviewer_id = :eid
        """), {"eid": eid})
        db.execute(text("DELETE FROM documents WHERE employee_id = :eid"), {"eid": eid})
        db.execute(text("DELETE FROM employee_shift_mappings WHERE employee_id = :eid"), {"eid": eid})
        db.execute(text("""
            DELETE FROM shift_swap_requests
            WHERE requester_id = :eid OR requested_employee_id = :eid
        """), {"eid": eid})
        db.execute(text("DELETE FROM policy_assignments WHERE employee_id = :eid"), {"eid": eid})
        db.execute(text("DELETE FROM travel_requests WHERE employee_id = :eid"), {"eid": eid})
        db.execute(text("DELETE FROM asset_requisitions WHERE employee_id = :eid"), {"eid": eid})
        db.execute(text("DELETE FROM password_reset_tokens WHERE employee_id = :eid"), {"eid": eid})
        db.execute(text("DELETE FROM user_activity_log WHERE employee_id = :eid"), {"eid": eid})
        if emp_str_id:
            db.execute(text("DELETE FROM leave_enablement_requests WHERE employee_id = :str_id"), {"str_id": emp_str_id})

        db.execute(text("DELETE FROM users WHERE emp_id = :eid"), {"eid": eid})
        if emp_str_id:
            db.execute(text("DELETE FROM user_roles WHERE employee_id = :str_id"), {"str_id": emp_str_id})

        # Org chart editor canvas placement — must go before the employee row
        # or the FK on org_chart_layouts.employee_id blocks the delete.
        db.execute(text("DELETE FROM org_chart_layouts WHERE employee_id = :eid"), {"eid": eid})

        # ── Step 3: Delete the employee row itself ──────────────────────────────
        db.delete(emp)
        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed and was rolled back: {str(e)}")


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin)
):
    if current_user.id == employee_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own profile")
    _hard_delete_employee(db, employee_id)
    return {"message": "Employee profile deleted successfully"}
