#!/usr/bin/env python3
"""
Phase 3: give the `users` table a real, narrow purpose — auth-adjacent
metadata (is_active, last_login), one row per employee. It carries no
role (that stays exclusively in user_roles) and is not used for login
(that stays on employees.hashed_password).

Backfills a users row for every employee that doesn't have one yet.
Idempotent — safe to run again.

Run from the backend/ directory:
    python migrate_users_table.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.base import Employee, User


def main():
    db = SessionLocal()
    try:
        employees = db.query(Employee).all()
        existing_emp_ids = {u.emp_id for u in db.query(User.emp_id).all()}

        created = 0
        for emp in employees:
            if emp.id in existing_emp_ids:
                continue
            db.add(User(
                emp_id=emp.id,
                employee_id=emp.employee_id,
                full_name=f"{emp.first_name} {emp.last_name}",
                email=emp.email,
                is_active=(emp.status != "terminated"),
            ))
            created += 1
        db.commit()

        total = db.query(User).count()
        print(f"Created {created} new users rows.")
        print(f"Total users rows now: {total} (employees: {len(employees)})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
