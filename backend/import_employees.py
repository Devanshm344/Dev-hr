"""
Import employees from Excel (XLS) file into the database.
Run: python import_employees.py
"""
import sys
sys.path.append(".")

import xlrd
from datetime import date, datetime
from sqlalchemy import func
from app.db.database import SessionLocal, engine
from app.models.base import Base, Employee, Department, LeaveType, LeaveBalance
from app.core.security import get_password_hash

XLS_PATH = r"C:\Users\mshinde\OneDrive - Cotelligent India Pvt. Ltd\Employee View (8).xls"

def excel_date(value):
    """Convert Excel date serial number to Python date."""
    if not value:
        return None
    try:
        v = float(value)
        if v < 1:
            return None
        return datetime(*xlrd.xldate_as_tuple(v, 0)).date()
    except Exception:
        return None

def clean_str(value, max_len=None):
    """Convert to stripped string, return None if empty."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if max_len and len(s) > max_len:
        s = s[:max_len]
    return s

def map_status(status_str):
    """Map CSV Employee status to StatusEnum."""
    if not status_str:
        return "active"
    s = status_str.strip().lower()
    if s == "active":
        return "active"
    if s == "inactive":
        return "inactive"
    return "inactive"

def map_role(job_role_str):
    """Map CSV Role to system role (admin/hr_manager/manager/employee)."""
    if not job_role_str:
        return "employee"
    r = job_role_str.strip().lower()
    if r in ("admin", "chief executive officer", "director"):
        return "admin"
    if r in ("hr desk", "hr&timesheets"):
        return "hr_manager"
    if r in ("manager", "assistant vice president", "travel desk"):
        return "manager"
    return "employee"

def get_or_create_department(db, dept_name):
    """Return existing department or create it."""
    if not dept_name or not dept_name.strip():
        return None
    name = dept_name.strip()
    dept = db.query(Department).filter(Department.name == name).first()
    if not dept:
        code = name[:10].upper().replace(" ", "_")
        dept = Department(name=name, code=code, description=name)
        db.add(dept)
        db.flush()
    return dept

def import_employees():
    db = SessionLocal()
    try:
        wb = xlrd.open_workbook(XLS_PATH)
        ws = wb.sheet_by_index(0)
        headers = ws.row_values(0)

        def col(name):
            try:
                return headers.index(name)
            except ValueError:
                return None

        # Column index map
        C = {
            "employee_id":       col("EmployeeID"),
            "first_name":        col("First Name"),
            "last_name":         col("Last Name"),
            "job_role":          col("Role"),
            "title":             col("Title"),
            "work_location":     col("Work Location"),
            "department":        col("Department"),
            "sub_department":    col("Sub Department"),
            "email":             col("Email ID"),
            "reporting_manager": col("Reporting Manager"),
            "present_address":   col("Present Address"),
            "mobile_phone":      col("Mobile Phone"),
            "date_of_birth":     col("Birth Date"),
            "personal_email":    col("Personal Email"),
            "extension":         col("Extension"),
            "work_phone":        col("Work phone"),
            "date_of_joining":   col("Date of joining / Rehire Date"),
            "blood_group":       col("Blood group"),
            "gender":            col("Gender"),
            "status":            col("Employee status"),
            "date_of_exit":      col("Date of exit"),
            "profile_picture":   col("Photo"),
            "about_me":          col("About Me"),
            "emergency_primary_name":    col("Emergency contact Name - Primary"),
            "employment_type":   col("Employee type"),
            "emergency_secondary_name":  col("Emergency Contact Name - Secondary"),
            "marital_status":    col("Marital status"),
            "source_of_hire":    col("Source of hire"),
            "permanent_address": col("Permanent Address"),
            "emergency_primary_number":   col("Emergency Contact Number - Primary"),
            "emergency_secondary_number": col("Emergency Contact Number - Secondary"),
            "onboarding_status": col("Onboarding Status"),
            "father_name":       col("Father Name"),
            "last_working_day":  col("Last Working Day"),
            "probation_end_date": col("Probation Ends on"),
            "primary_skill_set": col("Primary Skill Set"),
            "secondary_skill_set": col("Secondary Skill Set"),
            "other_skills":      col("Other Skills"),
            "total_experience":  col("Total Experience"),
            "pan_number":        col("PAN Number"),
            "aadhar_number":     col("Aadhar Number"),
            "current_project":   col("Current Project"),
            "bank_name":         col("Bank Name"),
            "bank_account_number": col("Bank Account Number"),
            "ifsc_code":         col("IFSC Code"),
            "bank_account_holder_name": col("Name As Appears in Bank Account"),
            "probation_completing_date": col("Probation Completing Date"),
            "exit_reason":       col("Exit Reason"),
            "job_level":         col("Job Level"),
            "passport_number":   col("Passport Number"),
            "passport_valid_from": col("Passport Valid From"),
            "passport_valid_to":  col("Passport Valid To"),
        }

        def v(row_vals, key):
            idx = C.get(key)
            if idx is None:
                return None
            val = row_vals[idx]
            return val if val != "" else None

        imported = 0
        skipped = 0

        for row_num in range(1, ws.nrows):
            row = ws.row_values(row_num)

            email = clean_str(v(row, "email"))
            if not email or "@" not in email:
                skipped += 1
                continue
            email = email.lower().strip()

            # Skip if already exists
            if db.query(Employee).filter(func.lower(Employee.email) == email).first():
                skipped += 1
                continue

            dept_name = clean_str(v(row, "department"))
            dept = get_or_create_department(db, dept_name)

            emp_id_raw = v(row, "employee_id")
            emp_id = clean_str(emp_id_raw, 50) if emp_id_raw else None

            job_role = clean_str(v(row, "job_role"))
            system_role = map_role(job_role)
            status = map_status(clean_str(v(row, "status")))

            # Probation date: use whichever column has data
            prob_date = excel_date(v(row, "probation_end_date")) or excel_date(v(row, "probation_completing_date"))

            emp = Employee(
                employee_id=emp_id,
                first_name=clean_str(v(row, "first_name")) or "Unknown",
                last_name=clean_str(v(row, "last_name")) or "",
                email=email,
                mobile_phone=clean_str(v(row, "mobile_phone"), 30),
                personal_email=clean_str(v(row, "personal_email"), 255),
                extension=clean_str(v(row, "extension"), 20),
                work_phone=clean_str(v(row, "work_phone"), 30),
                hashed_password=get_password_hash("Welcome@123"),
                role=system_role,
                job_role=clean_str(job_role, 100),
                employment_type=clean_str(v(row, "employment_type"), 50),
                status=status,
                onboarding_status=clean_str(v(row, "onboarding_status"), 50),
                department_id=dept.id if dept else None,
                sub_department=clean_str(v(row, "sub_department"), 100),
                reporting_manager_name=clean_str(v(row, "reporting_manager"), 200),
                title=clean_str(v(row, "title"), 200),
                job_level=clean_str(v(row, "job_level"), 100),
                work_location=clean_str(v(row, "work_location"), 200),
                date_of_joining=excel_date(v(row, "date_of_joining")),
                date_of_birth=excel_date(v(row, "date_of_birth")),
                date_of_exit=excel_date(v(row, "date_of_exit")),
                last_working_day=excel_date(v(row, "last_working_day")),
                probation_end_date=prob_date,
                exit_reason=clean_str(v(row, "exit_reason")),
                gender=clean_str(v(row, "gender"), 20),
                blood_group=clean_str(v(row, "blood_group"), 20),
                marital_status=clean_str(v(row, "marital_status"), 30),
                father_name=clean_str(v(row, "father_name"), 200),
                about_me=clean_str(v(row, "about_me")),
                source_of_hire=clean_str(v(row, "source_of_hire"), 100),
                present_address=clean_str(v(row, "present_address")),
                permanent_address=clean_str(v(row, "permanent_address")),
                emergency_contact_primary_name=clean_str(v(row, "emergency_primary_name"), 200),
                emergency_contact_primary_number=clean_str(v(row, "emergency_primary_number"), 30),
                emergency_contact_secondary_name=clean_str(v(row, "emergency_secondary_name"), 200),
                emergency_contact_secondary_number=clean_str(v(row, "emergency_secondary_number"), 30),
                profile_picture=clean_str(v(row, "profile_picture"), 500),
                primary_skill_set=clean_str(v(row, "primary_skill_set")),
                secondary_skill_set=clean_str(v(row, "secondary_skill_set")),
                other_skills=clean_str(v(row, "other_skills")),
                total_experience=clean_str(v(row, "total_experience"), 100),
                current_project=clean_str(v(row, "current_project"), 200),
                pan_number=clean_str(v(row, "pan_number"), 20),
                aadhar_number=clean_str(v(row, "aadhar_number"), 25),
                bank_account_number=clean_str(v(row, "bank_account_number"), 30),
                bank_name=clean_str(v(row, "bank_name"), 100),
                ifsc_code=clean_str(v(row, "ifsc_code"), 20),
                bank_account_holder_name=clean_str(v(row, "bank_account_holder_name"), 200),
                passport_number=clean_str(v(row, "passport_number"), 30),
                passport_valid_from=excel_date(v(row, "passport_valid_from")),
                passport_valid_to=excel_date(v(row, "passport_valid_to")),
            )
            db.add(emp)
            imported += 1

            if imported % 50 == 0:
                db.commit()
                print(f"  {imported} employees imported so far...")

        db.commit()

        # Seed leave types
        leave_types = [
            ("Casual Leave", "CL", 12, False, True),
            ("Sick Leave", "SL", 10, False, True),
            ("Earned Leave", "EL", 21, True, True),
            ("Maternity Leave", "ML", 182, False, True),
            ("Paternity Leave", "PL", 15, False, True),
            ("Loss of Pay", "LOP", 0, False, False),
            ("Compensatory Off", "CO", 0, False, True),
        ]
        for name, code, days, carry, paid in leave_types:
            if not db.query(LeaveType).filter(LeaveType.code == code).first():
                db.add(LeaveType(name=name, code=code, days_allowed=days, carry_forward=carry, paid=paid))
        db.commit()

        print(f"\nImport complete!")
        print(f"  Imported : {imported} employees")
        print(f"  Skipped  : {skipped} rows (missing email or duplicates)")
        print(f"  Departments created from data.")
        print(f"\nAll employees have default password: Welcome@123")

    except Exception as e:
        db.rollback()
        print(f"Error at row {row_num}: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    import_employees()
