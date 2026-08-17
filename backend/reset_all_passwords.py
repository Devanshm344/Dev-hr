#!/usr/bin/env python3
"""
One-time reset: set every employee's password to the new default (demo@123)
ahead of production rollout. Individual users are expected to change their
password afterward via the existing self-service flow (Profile page ->
Change Password, backed by POST /auth/change-password).

Targets whatever database backend/.env's DATABASE_URL points at (SessionLocal) —
there is only one configured database now (see app/db/database.py).

Run from the backend/ directory:
    python reset_all_passwords.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.base import Employee
from app.core.security import get_password_hash

NEW_DEFAULT_PASSWORD = "demo@123"


def main():
    db = SessionLocal()
    try:
        employees = db.query(Employee).all()
        new_hash = get_password_hash(NEW_DEFAULT_PASSWORD)
        for emp in employees:
            emp.hashed_password = new_hash
        db.commit()
        print(f"Reset password for {len(employees)} employees to '{NEW_DEFAULT_PASSWORD}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
