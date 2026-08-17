#!/usr/bin/env python3
"""
One-off utility to set system_role for specific employees by employee_id.

Superseded design note: this used to write raw SQL directly to
employees.role, which bypassed user_roles (the actual RBAC source of
truth) entirely and could silently leave someone's real access
unchanged despite the script reporting success. employees.role no
longer exists — system_role lives exclusively in user_roles now.

Prefer the User Management UI for one-off role changes. Use this script
only for bulk/scripted fixes that go through the same set_system_role()
write path as the rest of the app (create_employee, User Management),
so there is never a second, drifting code path for role writes.

Run from the backend/ directory:
    python fix_roles.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.base import Employee
from app.core.security import set_system_role

# (employee_id, system_role) — system_role must be one of Employee/Admin/Super Admin
UPDATES = [
    # ("599", "Admin"),
]


def main():
    if not UPDATES:
        print("UPDATES is empty — nothing to do. Edit the list above and re-run.")
        return

    db = SessionLocal()
    try:
        for emp_id, system_role in UPDATES:
            emp = db.query(Employee).filter(Employee.employee_id == emp_id).first()
            if not emp:
                print(f"  [SKIP] {emp_id} not found")
                continue
            set_system_role(db, emp, system_role)
            print(f"  {emp.employee_id} | {emp.first_name} {emp.last_name} => {system_role}")
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
