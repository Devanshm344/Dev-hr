"""
Targeted script to add the 5 named users with correct roles.
Run: python add_named_users.py
"""
import sys
sys.path.append(".")

from datetime import date
from app.db.database import SessionLocal
from app.models.base import Employee, Department, UserRole
from app.core.security import get_password_hash


def get_or_warn_dept(db, code, fallback_name):
    dept = db.query(Department).filter(Department.code == code).first()
    if not dept:
        dept = db.query(Department).filter(Department.name.ilike(f"%{fallback_name}%")).first()
    if not dept:
        dept = db.query(Department).first()
        print(f"  WARNING: Could not find '{fallback_name}' dept - using '{dept.name}' as fallback")
    return dept


USERS = [
    # (employee_id, first, last, email, role, designation, dept_code, dept_fallback, salary, gender)
    ("CTL-0007", "Sridhar",   "Iriventi",    "sridhar.iriventi@techdemocracy.com",  "admin",    "Senior Administrator", "HR",  "Human Resources", 95000, "Male"),
    ("CTL-0008", "Sai",       "Yalamanchili","sai.yalamanchili@techdemocracy.com",   "admin",    "HR Administrator",     "HR",  "Human Resources", 90000, "Male"),
    ("CTL-0009", "Lakshmi",   "Narayana",    "lakshmi.narayana@techdemocracy.com",   "admin",    "Admin Manager",        "HR",  "Human Resources", 92000, "Female"),
    ("CTL-0010", "Mrutunjay", "Shinde",      "mrutunjay.shinde@techdemocracy.com",   "employee", "Software Engineer",    "ENG", "Engineering",     68000, "Male"),
    ("CTL-0011", "Ramu",      "Vundavelli",  "ramu.vundavelli@techdemocracy.com",    "employee", "Software Developer",   "ENG", "Engineering",     65000, "Male"),
]


def sync_system_role(db, emp_id, email, role):
    """role is 'admin' or 'employee' here. Only ever grants Admin; never
    downgrades an existing row (e.g. someone since promoted to Super Admin
    via User Management should not be silently demoted by this script)."""
    if role != "admin":
        return
    existing_ur = db.query(UserRole).filter(UserRole.employee_id == emp_id).first()
    if existing_ur:
        if existing_ur.system_role == "Employee":
            existing_ur.system_role = "Admin"
            db.commit()
    else:
        db.add(UserRole(employee_id=emp_id, email=email, system_role="Admin"))
        db.commit()


def run():
    db = SessionLocal()
    try:
        results = []
        for emp_id, fn, ln, email, role, desig, dept_code, dept_fallback, salary, gender in USERS:
            existing = db.query(Employee).filter(Employee.email == email).first()
            if existing:
                sync_system_role(db, emp_id, email, role)
                results.append(f"  EXISTS   {email}  role: {role} (user_roles synced)")
            else:
                dept = get_or_warn_dept(db, dept_code, dept_fallback)
                e = Employee(
                    employee_id=emp_id,
                    first_name=fn,
                    last_name=ln,
                    email=email,
                    hashed_password=get_password_hash("Welcome@123"),
                    designation=desig,
                    department_id=dept.id,
                    date_of_joining=date(2024, 1, 15),
                    status="active",
                    base_salary=salary,
                    gender=gender,
                    phone="9000000000",
                )
                db.add(e)
                db.commit()
                sync_system_role(db, emp_id, email, role)
                results.append(f"  CREATED  {email}  role: {role}")

        print("\nNamed users sync complete:")
        for r in results:
            print(r)

        print("\nLogin credentials (password: Admin@123)")
        print("   Admin:    sridhar.iriventi@techdemocracy.com")
        print("   Admin:    sai.yalamanchili@techdemocracy.com")
        print("   Admin:    lakshmi.narayana@techdemocracy.com")
        print("   Employee: mrutunjay.shinde@techdemocracy.com")
        print("   Employee: ramu.vundavelli@techdemocracy.com")
    finally:
        db.close()


if __name__ == "__main__":
    run()
