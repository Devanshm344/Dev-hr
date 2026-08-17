#!/usr/bin/env python3
"""
One-time migration: leave_requests.employee_id currently stores the internal
employees.id (surrogate PK, e.g. 28). It must store the business Employee ID
from employees.employee_id (e.g. "625") instead, matching how it's already
displayed everywhere else in the app.

Converts the column from INTEGER (FK -> employees.id) to VARCHAR(50)
(FK -> employees.employee_id), backfilling existing rows from the employees
table before swapping the column over.

Idempotent: skips a database once its leave_requests.employee_id column is
no longer of type integer (i.e. this script already ran against it).

Run from the backend/ directory:
    python migrate_leave_employee_id.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

DB_HOST     = "localhost"
DB_PORT     = 5432
DB_USER     = "postgres"
DB_PASSWORD = "CHANGE_ME_DB_PASSWORD"
# Map logical name -> actual PostgreSQL DB name
DATABASES = [
    ("cotelligent-hrms", "cotelligent_hrms"),
    ("dev-hr",           "dev-hr"),
]


def migrate_db(db_url: str, db_name: str):
    print(f"\n{'='*55}")
    print(f"  Database: {db_name}")
    print(f"{'='*55}")

    try:
        engine = create_engine(db_url, pool_pre_ping=True)
    except Exception as e:
        print(f"  [SKIP] Cannot connect: {e}")
        return

    with engine.connect() as conn:
        col_type = conn.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'leave_requests' AND column_name = 'employee_id'"
        )).scalar()

        if col_type is None:
            print("  [SKIP] leave_requests.employee_id column not found")
            return
        if col_type != "integer":
            print(f"  [SKIP] Already migrated (column type: {col_type})")
            return

        try:
            orphans = conn.execute(text("""
                SELECT COUNT(*) FROM leave_requests lr
                LEFT JOIN employees e ON e.id = lr.employee_id
                WHERE e.id IS NULL OR e.employee_id IS NULL
            """)).scalar()
            if orphans:
                raise RuntimeError(
                    f"{orphans} leave_requests row(s) reference a missing employee "
                    "or an employee with no employee_id set — resolve before migrating"
                )

            fk_name = conn.execute(text("""
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'leave_requests'::regclass
                  AND contype = 'f'
                  AND conkey = ARRAY[(
                      SELECT attnum FROM pg_attribute
                      WHERE attrelid = 'leave_requests'::regclass AND attname = 'employee_id'
                  )]
            """)).scalar()
            if fk_name:
                conn.execute(text(f'ALTER TABLE leave_requests DROP CONSTRAINT "{fk_name}"'))
                print(f"  [OK] Dropped old FK constraint '{fk_name}' (-> employees.id)")

            conn.execute(text("ALTER TABLE leave_requests ADD COLUMN employee_id_new VARCHAR(50)"))
            result = conn.execute(text("""
                UPDATE leave_requests lr
                SET employee_id_new = e.employee_id
                FROM employees e
                WHERE e.id = lr.employee_id
            """))
            print(f"  [OK] Backfilled {result.rowcount} leave_requests row(s) with business Employee ID")

            conn.execute(text("ALTER TABLE leave_requests DROP COLUMN employee_id"))
            conn.execute(text("ALTER TABLE leave_requests RENAME COLUMN employee_id_new TO employee_id"))
            conn.execute(text("ALTER TABLE leave_requests ALTER COLUMN employee_id SET NOT NULL"))
            conn.execute(text("""
                ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_employee_id_fkey
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            """))
            print("  [OK] Column converted to VARCHAR(50), FK now -> employees.employee_id")

            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"  [FAIL] Migration rolled back: {e}")


def main():
    print("\n[migrate_leave_employee_id] Starting...")
    for logical_name, pg_name in DATABASES:
        url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{pg_name}"
        migrate_db(url, logical_name)
    print("\n[migrate_leave_employee_id] Done.\n")


if __name__ == "__main__":
    main()
