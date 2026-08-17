#!/usr/bin/env python3
"""
Idempotent migration: make user_roles the single source of truth for RBAC role.

Steps, per database:
  1. Backfill user_roles for any employee whose legacy employees.role is
     'admin' but who has no user_roles row yet (so nobody's access silently
     drops when the column disappears).
  2. Rename user_roles.role -> user_roles.system_role.
  3. Drop the legacy employees.role column (and its enum type).
  4. Drop the legacy, unused users.role column (and its enum type) — the
     `users` table is never read/written for role at runtime (get_effective_role
     always resolves from user_roles); it was a stale, unpopulated duplicate.

Run from the backend/ directory:
    python migrate_system_role.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

DB_HOST     = "localhost"
DB_PORT     = 5432
DB_USER     = "postgres"
DB_PASSWORD = "CHANGE_ME_DB_PASSWORD"
DATABASES   = [
    ("dev-hr", "dev-hr"),
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

    with engine.begin() as conn:
        # Guard: only proceed if employees.role still exists (idempotent re-run safety)
        has_employees_role = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='employees' AND column_name='role'"
        )).fetchone()
        has_system_role = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='user_roles' AND column_name='system_role'"
        )).fetchone()

        # 1. Backfill user_roles for legacy admins with no row yet
        if has_employees_role:
            backfilled = conn.execute(text("""
                INSERT INTO user_roles (employee_id, email, role)
                SELECT e.employee_id, e.email, 'Admin'
                FROM employees e
                WHERE e.role::text = 'admin'
                  AND e.employee_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM user_roles ur WHERE ur.employee_id = e.employee_id
                  )
                RETURNING employee_id
            """) if not has_system_role else text("""
                INSERT INTO user_roles (employee_id, email, system_role)
                SELECT e.employee_id, e.email, 'Admin'
                FROM employees e
                WHERE e.role::text = 'admin'
                  AND e.employee_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM user_roles ur WHERE ur.employee_id = e.employee_id
                  )
                RETURNING employee_id
            """))
            rows = backfilled.fetchall()
            if rows:
                print(f"  [BACKFILL] user_roles created for: {[r[0] for r in rows]}")
            else:
                print("  [OK] No backfill needed — every admin already has a user_roles row")
        else:
            print("  [SKIP] employees.role already gone — backfill step not applicable")

        # 2. Rename user_roles.role -> system_role (idempotent)
        if not has_system_role:
            conn.execute(text("ALTER TABLE user_roles RENAME COLUMN role TO system_role"))
            print("  [OK] user_roles.role renamed to system_role")
        else:
            print("  [OK] user_roles.system_role already present")

        # 3. Drop employees.role column + its enum type (idempotent)
        if has_employees_role:
            conn.execute(text("ALTER TABLE employees DROP COLUMN role"))
            print("  [OK] employees.role column dropped")
        else:
            print("  [OK] employees.role already dropped")

        conn.execute(text("DROP TYPE IF EXISTS roleenum"))
        print("  [OK] roleenum type dropped (if it existed)")

        # 4. Drop the legacy, unused users.role column + its enum type (idempotent)
        has_users_role = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='users' AND column_name='role'"
        )).fetchone()
        if has_users_role:
            conn.execute(text("ALTER TABLE users DROP COLUMN role"))
            print("  [OK] users.role column dropped (unused legacy duplicate)")
        else:
            print("  [OK] users.role already dropped")

        conn.execute(text("DROP TYPE IF EXISTS user_system_role"))
        print("  [OK] user_system_role type dropped (if it existed)")

        # 5. Report final state
        final_roles = conn.execute(text(
            "SELECT system_role, count(*) FROM user_roles GROUP BY system_role ORDER BY system_role"
        )).fetchall()
        print(f"\n  Final user_roles distribution ({db_name}):")
        for role, count in final_roles:
            print(f"    {role:<15} {count}")


def main():
    print("\n[migrate_system_role] Starting...")
    for logical_name, pg_name in DATABASES:
        url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{pg_name}"
        migrate_db(url, logical_name)
    print("\n[migrate_system_role] Done.\n")


if __name__ == "__main__":
    main()
