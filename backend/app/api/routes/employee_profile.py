from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from pydantic import BaseModel
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, User, UserRole
from app.core.security import get_current_user, get_effective_role, is_admin_role
from app.services.activity_log import log_activity as _log_activity

router = APIRouter()

FIELD_LABELS = {
    "first_name": "First Name", "last_name": "Last Name", "email": "Work Email",
    "mobile_phone": "Mobile Phone", "gender": "Gender", "blood_group": "Blood Group",
    "marital_status": "Marital Status", "about_me": "About Me",
    "present_address": "Present Address", "permanent_address": "Permanent Address",
    "city": "City", "state": "State", "country": "Country", "pincode": "Pincode",
    "title": "Designation", "department_id": "Department", "sub_department": "Sub Department",
    "job_role": "Job Role", "employment_type": "Employment Type", "source_of_hire": "Source of Hire",
    "work_location": "Work Location", "status": "Employment Status", "base_salary": "Base Salary",
    "date_of_joining": "Date of Joining", "probation_end_date": "Probation End Date",
    "job_level": "Job Level", "manager_id": "Reporting Manager",
    "pan_number": "PAN Number", "aadhar_number": "Aadhar Number",
    "bank_account_number": "Bank Account Number", "bank_name": "Bank Name",
    "ifsc_code": "IFSC Code", "bank_account_holder_name": "Bank Account Holder Name",
    "primary_skill_set": "Primary Skills", "secondary_skill_set": "Secondary Skills",
    "other_skills": "Other Skills", "total_experience": "Total Experience",
    "current_project": "Current Project", "passport_number": "Passport Number",
    "passport_valid_from": "Passport Valid From", "passport_valid_to": "Passport Valid To",
    "personal_email": "Personal Email", "work_phone": "Work Phone", "extension": "Extension",
    "date_of_birth": "Date of Birth", "father_name": "Father's Name",
    "emergency_contact_primary_name": "Emergency Contact (Primary Name)",
    "emergency_contact_primary_number": "Emergency Contact (Primary Number)",
    "emergency_contact_secondary_name": "Emergency Contact (Secondary Name)",
    "emergency_contact_secondary_number": "Emergency Contact (Secondary Number)",
}


def build_profile(emp: Employee, is_admin: bool, is_self: bool, system_role: str) -> dict:
    profile = {
        "id": emp.id,
        "employee_id": emp.employee_id,
        "name": f"{emp.first_name} {emp.last_name}",
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "email": emp.email,
        "role": system_role,
        "status": emp.status.value if emp.status else None,
        "title": emp.title,
        "department": emp.department.name if emp.department else None,
        "department_id": emp.department_id,
        "profile_picture": emp.profile_picture,

        "personal": {
            "mobile_phone": emp.mobile_phone,
            "work_phone": emp.work_phone,
            "extension": emp.extension,
            "personal_email": emp.personal_email,
            "gender": emp.gender,
            "date_of_birth": str(emp.date_of_birth) if emp.date_of_birth else None,
            "blood_group": emp.blood_group,
            "marital_status": emp.marital_status,
            "father_name": emp.father_name,
            "about_me": emp.about_me,
        },

        "address": {
            "present_address": emp.present_address,
            "permanent_address": emp.permanent_address,
            "city": emp.city,
            "state": emp.state,
            "country": emp.country,
            "pincode": emp.pincode,
        },

        "employment": {
            "job_role": emp.job_role,
            "job_level": emp.job_level,
            "employment_type": emp.employment_type,
            "onboarding_status": emp.onboarding_status,
            "work_location": emp.work_location,
            "sub_department": emp.sub_department,
            "date_of_joining": str(emp.date_of_joining) if emp.date_of_joining else None,
            "probation_end_date": str(emp.probation_end_date) if emp.probation_end_date else None,
            "date_of_exit": str(emp.date_of_exit) if emp.date_of_exit else None,
            "last_working_day": str(emp.last_working_day) if emp.last_working_day else None,
            "exit_reason": emp.exit_reason,
            "source_of_hire": emp.source_of_hire,
            "manager_id": emp.manager_id,
            "manager": f"{emp.manager.first_name} {emp.manager.last_name}" if emp.manager else None,
            "reporting_manager_name": emp.reporting_manager_name,
            "base_salary": emp.base_salary if is_admin else None,
        },

        "skills": {
            "primary_skill_set": emp.primary_skill_set,
            "secondary_skill_set": emp.secondary_skill_set,
            "other_skills": emp.other_skills,
            "total_experience": emp.total_experience,
            "current_project": emp.current_project,
        },

        "emergency_contacts": {
            "primary_name": emp.emergency_contact_primary_name,
            "primary_number": emp.emergency_contact_primary_number,
            "secondary_name": emp.emergency_contact_secondary_name,
            "secondary_number": emp.emergency_contact_secondary_number,
        },
    }

    if is_admin or is_self:
        profile["bank_tax"] = {
            "pan_number": emp.pan_number,
            "aadhar_number": emp.aadhar_number,
            "bank_account_number": emp.bank_account_number,
            "bank_name": emp.bank_name,
            "ifsc_code": emp.ifsc_code,
            "bank_account_holder_name": emp.bank_account_holder_name,
            "passport_number": emp.passport_number,
            "passport_valid_from": str(emp.passport_valid_from) if emp.passport_valid_from else None,
            "passport_valid_to": str(emp.passport_valid_to) if emp.passport_valid_to else None,
        }

    return profile


@router.get("/{employee_id}")
def get_employee_profile(
    employee_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    is_self  = current_user.id == employee_id

    return build_profile(emp, is_admin, is_self, get_effective_role(emp, auth_db))


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile_phone: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    marital_status: Optional[str] = None
    about_me: Optional[str] = None
    present_address: Optional[str] = None
    permanent_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    # admin-only fields
    title: Optional[str] = None
    department_id: Optional[int] = None
    sub_department: Optional[str] = None
    job_role: Optional[str] = None
    employment_type: Optional[str] = None
    source_of_hire: Optional[str] = None
    work_location: Optional[str] = None
    status: Optional[str] = None
    base_salary: Optional[float] = None
    date_of_joining: Optional[date] = None
    probation_end_date: Optional[date] = None
    job_level: Optional[str] = None
    manager_id: Optional[int] = None
    # self or admin
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_account_holder_name: Optional[str] = None
    primary_skill_set: Optional[str] = None
    secondary_skill_set: Optional[str] = None
    other_skills: Optional[str] = None
    total_experience: Optional[str] = None
    current_project: Optional[str] = None
    passport_number: Optional[str] = None
    passport_valid_from: Optional[date] = None
    passport_valid_to: Optional[date] = None
    # admin-only personal detail fields
    email: Optional[str] = None
    personal_email: Optional[str] = None
    work_phone: Optional[str] = None
    extension: Optional[str] = None
    date_of_birth: Optional[date] = None
    father_name: Optional[str] = None
    # admin-only emergency contact fields
    emergency_contact_primary_name: Optional[str] = None
    emergency_contact_primary_number: Optional[str] = None
    emergency_contact_secondary_name: Optional[str] = None
    emergency_contact_secondary_number: Optional[str] = None


@router.put("/{employee_id}")
def update_employee_profile(
    employee_id: int,
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    is_self  = current_user.id == employee_id

    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Permission denied")

    admin_only = {
        "title", "department_id", "sub_department", "job_role", "employment_type",
        "source_of_hire", "work_location", "status", "base_salary",
        "date_of_joining", "probation_end_date", "job_level", "manager_id",
        "email", "personal_email", "work_phone", "extension", "date_of_birth", "father_name",
        "emergency_contact_primary_name", "emergency_contact_primary_number",
        "emergency_contact_secondary_name", "emergency_contact_secondary_number",
    }

    update_data = data.dict(exclude_unset=True)

    if "email" in update_data and is_admin:
        new_email = (update_data["email"] or "").strip().lower()
        if not new_email:
            raise HTTPException(status_code=400, detail="Email cannot be empty")
        if new_email != emp.email.lower():
            dupe = db.query(Employee).filter(
                Employee.id != employee_id,
                Employee.email.ilike(new_email),
            ).first()
            if dupe:
                raise HTTPException(status_code=400, detail="This email is already in use by another employee")
            login_row = db.query(User).filter(User.emp_id == employee_id).first()
            if login_row:
                login_row.email = new_email
            # Keep user_roles.email in sync too — it's a second copy of the
            # same email (see set_system_role() in core/security.py, which
            # already does this on the role-assignment path). Without this,
            # editing an employee's email here silently drifts this copy out
            # of sync with the one on the employees row.
            role_row = db.query(UserRole).filter(UserRole.employee_id == emp.employee_id).first()
            if role_row:
                role_row.email = new_email
        update_data["email"] = new_email

    if "manager_id" in update_data and is_admin:
        new_manager_id = update_data["manager_id"]
        if new_manager_id and new_manager_id == employee_id:
            raise HTTPException(status_code=400, detail="Employee cannot be their own manager")
        if new_manager_id:
            visited: set = set()
            current_id = new_manager_id
            while current_id is not None:
                if current_id == employee_id:
                    raise HTTPException(status_code=400, detail="Cannot assign manager: circular hierarchy detected")
                if current_id in visited:
                    break
                visited.add(current_id)
                mgr = db.query(Employee).filter(Employee.id == current_id).first()
                if mgr is None:
                    break
                current_id = mgr.manager_id
        if new_manager_id:
            mgr = db.query(Employee).filter(Employee.id == new_manager_id).first()
            update_data["reporting_manager_name"] = f"{mgr.first_name} {mgr.last_name}" if mgr else None
        else:
            update_data["reporting_manager_name"] = None

    changed_labels = []
    email_changed = False
    for key, value in update_data.items():
        if key in admin_only and not is_admin:
            continue
        if key == "reporting_manager_name":
            setattr(emp, key, value)
            continue
        if getattr(emp, key) != value:
            changed_labels.append(FIELD_LABELS.get(key, key))
            if key == "email":
                email_changed = True
        setattr(emp, key, value)

    if changed_labels:
        detail = f"Updated: {', '.join(changed_labels)}"
        if email_changed:
            detail += f" (email → {update_data['email']})"
        _log_activity(db, employee_id, current_user.id, "profile_updated", detail)

    db.commit()
    db.refresh(emp)
    return build_profile(emp, is_admin, is_self, get_effective_role(emp, auth_db))
