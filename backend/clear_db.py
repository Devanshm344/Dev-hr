"""
Script to clear all mock/seed data from the database.
Run: python clear_db.py
"""
import sys
sys.path.append(".")

from app.db.database import SessionLocal, engine
from sqlalchemy import text

def clear_all_data():
    db = SessionLocal()
    try:
        print("Clearing all data from database...")

        # Disable FK checks temporarily and truncate in dependency order
        tables_in_order = [
            "asset_assignments",
            "assets",
            "leave_balances",
            "leave_requests",
            "payslips",
            "performance_reviews",
            "documents",
            "attendance",
            "announcements",
        ]

        # First nullify self-referential FK on employees (manager_id)
        db.execute(text("UPDATE employees SET manager_id = NULL"))
        db.commit()

        # Nullify department head FK
        db.execute(text("UPDATE departments SET head_id = NULL"))
        db.commit()

        for table in tables_in_order:
            db.execute(text(f"DELETE FROM {table}"))
            print(f"  Cleared: {table}")

        db.execute(text("DELETE FROM employees"))
        print("  Cleared: employees")

        db.execute(text("DELETE FROM departments"))
        print("  Cleared: departments")

        db.execute(text("DELETE FROM leave_types"))
        print("  Cleared: leave_types")

        db.commit()

        # Reset all sequences (PostgreSQL auto-increment)
        sequences = [
            ("asset_assignments", "id"),
            ("assets", "id"),
            ("leave_balances", "id"),
            ("leave_requests", "id"),
            ("payslips", "id"),
            ("performance_reviews", "id"),
            ("documents", "id"),
            ("attendance", "id"),
            ("announcements", "id"),
            ("employees", "id"),
            ("departments", "id"),
            ("leave_types", "id"),
        ]
        for table, col in sequences:
            db.execute(text(f"ALTER SEQUENCE {table}_{col}_seq RESTART WITH 1"))
        db.commit()

        print("\nAll mock data cleared successfully!")
        print("Database is now empty and ready for real data import.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("This will DELETE ALL data from the database. Type 'yes' to confirm: ")
    if confirm.strip().lower() == "yes":
        clear_all_data()
    else:
        print("Aborted.")
