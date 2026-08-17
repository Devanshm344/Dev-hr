#!/usr/bin/env python3
"""
One-time migration: leave_balances.employee_id currently stores the internal
employees.id (surrogate PK, e.g. 28). It must store the business Employee ID
from employees.employee_id (e.g. "597") instead, matching leave_requests
(see migrate_leave_employee_id.py) and everywhere else it's displayed.

Converts the column from INTEGER (FK -> employees.id) to VARCHAR(50)
(FK -> employees.employee_id) via an in-place ALTER COLUMN ... TYPE ... USING,
which preserves the column's physical position (it's already 2nd, right
after id) unlike an ADD/DROP/RENAME rebuild.

Idempotent: skips a database once the column is no longer of type integer
(i.e. this script already ran against it).

Run from the backend/ directory:
    python migrate_leave_balances_employee_id.py
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
            "WHERE table_name = 'leave_balances' AND column_name = 'employee_id'"
        )).scalar()

        if col_type is None:
            print("  [SKIP] leave_balances.employee_id column not found")
            return
        if col_type != "integer":
            print(f"  [SKIP] Already migrated (column type: {col_type})")
            return

        try:
            orphans = conn.execute(text("""
                SELECT COUNT(*) FROM leave_balances lb
                LEFT JOIN employees e ON e.id = lb.employee_id
                WHERE e.id IS NULL OR e.employee_id IS NULL
            """)).scalar()
            if orphans:
                raise RuntimeError(
                    f"{orphans} leave_balances row(s) reference a missing employee "
                    "or an employee with no employee_id set — resolve before migrating"
                )

            conn.execute(text(
                "ALTER TABLE leave_balances DROP CONSTRAINT leave_balances_employee_id_fkey"
            ))
            print("  [OK] Dropped old FK constraint (-> employees.id)")

            # Postgres disallows a correlated subquery in ALTER COLUMN ... USING, so
            # this is done in two steps: a plain cast (no data change, keeps position),
            # then a normal UPDATE ... FROM to remap values against the pre-update snapshot.
            conn.execute(text("""
                ALTER TABLE leave_balances
                ALTER COLUMN employee_id TYPE character varying(50)
                USING employee_id::character varying(50)
            """))
            result = conn.execute(text("""
                UPDATE leave_balances lb
                SET employee_id = e.employee_id
                FROM employees e
                WHERE lb.employee_id = e.id::character varying(50)
            """))
            print(f"  [OK] Converted employee_id to VARCHAR(50) in place, remapped {result.rowcount} row(s)")

            conn.execute(text("""
                ALTER TABLE leave_balances
                ADD CONSTRAINT leave_balances_employee_id_fkey
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            """))
            print("  [OK] Added new FK -> employees.employee_id")

            conn.commit()
            print("  [DONE]")
        except Exception as e:
            conn.rollback()
            print(f"  [FAIL] Migration rolled back: {e}")


def main():
    print("\n[migrate_leave_balances_employee_id] Starting...")
    for logical_name, pg_name in DATABASES:
        url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{pg_name}"
        migrate_db(url, logical_name)
    print("\n[migrate_leave_balances_employee_id] Done.\n")


if __name__ == "__main__":
    main()
