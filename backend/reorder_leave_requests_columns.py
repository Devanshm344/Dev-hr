#!/usr/bin/env python3
"""
One-time migration: move leave_requests.employee_id to be the second
physical column (right after id), instead of last.

PostgreSQL has no ALTER TABLE ... position clause to reorder columns in
place, so this rebuilds the table with the desired column order: creates a
new leave_requests with the same columns/types/defaults/nullability in the
target order, copies every row across unchanged, re-attaches the original
primary key, index, and foreign keys (by their original names), then drops
the old table. All within a single transaction, so a failure at any step
rolls back to the untouched original table.

Purely cosmetic — column order has no effect on SQLAlchemy, the API, or any
query (all access columns by name) — but is done here as requested for
schema readability.

Idempotent: skips a database once employee_id is already the 2nd column.

Run from the backend/ directory:
    python reorder_leave_requests_columns.py
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

# Target physical column order (must be a reordering of the existing columns —
# no adds, drops, renames, or type changes)
TARGET_COLUMNS = [
    "id", "employee_id", "leave_type_id", "start_date", "end_date", "days",
    "reason", "status", "approved_by", "approved_at", "rejection_reason",
    "created_at", "team_email", "attachment_url",
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
        current_cols = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'leave_requests'
            ORDER BY ordinal_position
        """)).scalars().all()

        if not current_cols:
            print("  [SKIP] leave_requests table not found")
            return
        if current_cols == TARGET_COLUMNS:
            print("  [SKIP] Already in target column order")
            return
        if sorted(current_cols) != sorted(TARGET_COLUMNS):
            raise RuntimeError(
                f"Column set mismatch — refusing to touch table. "
                f"current={current_cols} target={TARGET_COLUMNS}"
            )

        incoming_fks = conn.execute(text("""
            SELECT conname FROM pg_constraint
            WHERE confrelid = 'leave_requests'::regclass AND contype = 'f'
        """)).scalars().all()
        if incoming_fks:
            raise RuntimeError(
                f"Other tables reference leave_requests via FK {incoming_fks} — "
                "this script does not handle that case, aborting"
            )

        try:
            conn.execute(text("ALTER TABLE leave_requests RENAME TO leave_requests_old"))

            # Free up the constraint/index names so the rebuilt table can reuse them
            conn.execute(text("ALTER TABLE leave_requests_old DROP CONSTRAINT leave_requests_pkey"))
            conn.execute(text("DROP INDEX IF EXISTS ix_leave_requests_id"))
            conn.execute(text("ALTER TABLE leave_requests_old DROP CONSTRAINT leave_requests_approved_by_fkey"))
            conn.execute(text("ALTER TABLE leave_requests_old DROP CONSTRAINT leave_requests_employee_id_fkey"))
            conn.execute(text("ALTER TABLE leave_requests_old DROP CONSTRAINT leave_requests_leave_type_id_fkey"))
            print("  [OK] Renamed old table, freed constraint/index names")

            conn.execute(text("""
                CREATE TABLE leave_requests (
                    id integer NOT NULL DEFAULT nextval('leave_requests_id_seq'::regclass),
                    employee_id character varying(50) NOT NULL,
                    leave_type_id integer NOT NULL,
                    start_date date NOT NULL,
                    end_date date NOT NULL,
                    days double precision,
                    reason text,
                    status character varying(20),
                    approved_by integer,
                    approved_at timestamp with time zone,
                    rejection_reason text,
                    created_at timestamp with time zone DEFAULT now(),
                    team_email character varying(255),
                    attachment_url character varying(500)
                )
            """))

            col_list = ", ".join(TARGET_COLUMNS)
            result = conn.execute(text(f"""
                INSERT INTO leave_requests ({col_list})
                SELECT {col_list} FROM leave_requests_old ORDER BY id
            """))
            print(f"  [OK] Copied {result.rowcount} row(s) into rebuilt table")

            old_count = conn.execute(text("SELECT COUNT(*) FROM leave_requests_old")).scalar()
            new_count = conn.execute(text("SELECT COUNT(*) FROM leave_requests")).scalar()
            if old_count != new_count:
                raise RuntimeError(f"Row count mismatch after copy: old={old_count} new={new_count}")

            conn.execute(text("ALTER SEQUENCE leave_requests_id_seq OWNED BY leave_requests.id"))
            conn.execute(text("ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id)"))
            conn.execute(text("CREATE INDEX ix_leave_requests_id ON leave_requests USING btree (id)"))
            conn.execute(text("""
                ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_approved_by_fkey
                FOREIGN KEY (approved_by) REFERENCES employees(id)
            """))
            conn.execute(text("""
                ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_employee_id_fkey
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            """))
            conn.execute(text("""
                ALTER TABLE leave_requests
                ADD CONSTRAINT leave_requests_leave_type_id_fkey
                FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
            """))
            print("  [OK] Re-attached primary key, index, and all foreign keys")

            conn.execute(text("DROP TABLE leave_requests_old"))
            print("  [OK] Dropped old table")

            conn.commit()
            print(f"  [DONE] leave_requests columns now: {', '.join(TARGET_COLUMNS)}")
        except Exception as e:
            conn.rollback()
            print(f"  [FAIL] Migration rolled back: {e}")


def main():
    print("\n[reorder_leave_requests_columns] Starting...")
    for logical_name, pg_name in DATABASES:
        url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{pg_name}"
        migrate_db(url, logical_name)
    print("\n[reorder_leave_requests_columns] Done.\n")


if __name__ == "__main__":
    main()
