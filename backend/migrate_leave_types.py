#!/usr/bin/env python3
"""
Idempotent migration: update leave_types in all configured databases to match
the required business list.

Run from the backend/ directory:
    python migrate_leave_types.py

Required leave types after migration:
    Business Travel, Compensatory Off, Earned Leaves, Leave Bucket,
    Loss-of-Pay, Sick Leave, WFH_Emp Quota, WFH_Manager Quota,
    Maternity Leave, Paternity Leave

Obsolete types (Casual Leave, Privilege Leave) are deactivated rather than
deleted to preserve referential integrity with leave_requests and leave_balances.
Maternity Leave and Paternity Leave are re-activated as gender-specific leave.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

DB_HOST     = "localhost"
DB_PORT     = 5432
DB_USER     = "postgres"
DB_PASSWORD = "CHANGE_ME_DB_PASSWORD"
# Map logical name -> actual PostgreSQL DB name
DATABASES   = [
    ("cotelligent-hrms", "cotelligent_hrms"),
    ("dev-hr",           "dev-hr"),
]

# ── Target state ─────────────────────────────────────────────────────────────
# (name, code, days_allowed, carry_forward, paid, is_active)
TARGET_TYPES = [
    ("Sick Leave",        "SL",      10,  False, True,  True),
    ("Earned Leaves",     "EL",      21,  True,  True,  True),
    ("Loss-of-Pay",       "LOP",      0,  False, False, True),
    ("Compensatory Off",  "CO",       0,  False, True,  True),
    ("Business Travel",   "BT",       0,  False, True,  True),
    ("Leave Bucket",      "LB",       0,  False, True,  True),
    ("WFH_Emp Quota",     "WFH_EMP",  0,  False, True,  True),
    ("WFH_Manager Quota", "WFH_MGR",  0,  False, True,  True),
    ("Maternity Leave",   "ML",      182, False, True,  True),
    ("Paternity Leave",   "PL",       15, False, True,  True),
]

# Renames: old_name -> new record (matched by current name, idempotent)
RENAMES = {
    "Earned Leave":  ("Earned Leaves", "EL"),
    "Loss of Pay":   ("Loss-of-Pay",   "LOP"),
    "Privilege Leave": ("Earned Leaves", "EL"),   # dev-hr uses Privilege Leave
}

# Names to deactivate (not in required list)
DEACTIVATE_NAMES = {
    "Casual Leave",
    "Privilege Leave",
}

ACTIVE_CODES = {row[1] for row in TARGET_TYPES}


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
        # 1. Add is_active column if missing
        conn.execute(text(
            "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
        ))
        conn.execute(text(
            "UPDATE leave_types SET is_active = TRUE WHERE is_active IS NULL"
        ))
        print("  [OK] is_active column ensured")

        # 2. Apply renames (match by current name, update name + code if needed)
        for old_name, (new_name, new_code) in RENAMES.items():
            row = conn.execute(
                text("SELECT id, name, code FROM leave_types WHERE LOWER(name) = LOWER(:n)"),
                {"n": old_name}
            ).fetchone()
            if row:
                # Check target name doesn't already exist under a different id
                conflict = conn.execute(
                    text("SELECT id FROM leave_types WHERE LOWER(name) = LOWER(:n) AND id != :id"),
                    {"n": new_name, "id": row.id}
                ).fetchone()
                if conflict:
                    # Target name already exists — deactivate the old record instead
                    conn.execute(
                        text("UPDATE leave_types SET is_active = FALSE WHERE id = :id"),
                        {"id": row.id}
                    )
                    print(f"  [DEACTIVATE] '{old_name}' (duplicate of '{new_name}')")
                else:
                    conn.execute(
                        text("UPDATE leave_types SET name = :name, code = :code WHERE id = :id"),
                        {"name": new_name, "code": new_code, "id": row.id}
                    )
                    print(f"  [RENAME] '{old_name}' -> '{new_name}'")

        # 3. Deactivate obsolete types
        for name in DEACTIVATE_NAMES:
            result = conn.execute(
                text("UPDATE leave_types SET is_active = FALSE WHERE LOWER(name) = LOWER(:n) AND is_active = TRUE"),
                {"n": name}
            )
            if result.rowcount:
                print(f"  [DEACTIVATE] '{name}'")

        # 4. Insert missing active types
        for name, code, days, carry, paid, is_active in TARGET_TYPES:
            existing = conn.execute(
                text("SELECT id FROM leave_types WHERE code = :code OR LOWER(name) = LOWER(:name)"),
                {"code": code, "name": name}
            ).fetchone()
            if not existing:
                conn.execute(
                    text("""
                        INSERT INTO leave_types (name, code, days_allowed, carry_forward, paid, is_active)
                        VALUES (:name, :code, :days, :carry, :paid, :active)
                    """),
                    {"name": name, "code": code, "days": days,
                     "carry": carry, "paid": paid, "active": is_active}
                )
                print(f"  [INSERT] '{name}' ({code})")
            else:
                # Ensure existing active types are marked active
                if is_active:
                    conn.execute(
                        text("UPDATE leave_types SET is_active = TRUE, name = :name WHERE id = :id"),
                        {"name": name, "id": existing.id}
                    )

        # 5. Report final state
        rows = conn.execute(
            text("SELECT id, name, code, is_active FROM leave_types ORDER BY is_active DESC, name")
        ).fetchall()
        print(f"\n  Final leave_types ({db_name}):")
        print(f"  {'ID':>4}  {'Name':<22}  {'Code':<10}  Active")
        print(f"  {'-'*4}  {'-'*22}  {'-'*10}  ------")
        for r in rows:
            marker = "Y" if r.is_active else "-"
            print(f"  {r.id:>4}  {r.name:<22}  {str(r.code):<10}  {marker}")


def main():
    print("\n[migrate_leave_types] Starting...")
    for logical_name, pg_name in DATABASES:
        url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{pg_name}"
        migrate_db(url, logical_name)
    print("\n[migrate_leave_types] Done.\n")


if __name__ == "__main__":
    main()
