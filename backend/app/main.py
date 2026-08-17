import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.routes import (
    auth, employees, attendance, leave, payroll,
    performance, documents, departments, announcements, modules, assets, ai,
    employee_profile, user_management, shift, policy,
    travel, reimbursement, offboarding, insurance, asset_requisition,
    leave_tracker, orgchart, orgchart_editor, alumni_sso,
)
from app.db.database import engine, SessionLocal
from app.models import base
from app.core.config import settings

# Associate Engagement (Timesheet + PSA) module — see app/engagement/. It has
# its own raw-SQL data layer against the same dev-hr database and its own
# connection pool (separate from the SQLAlchemy engine above), so it needs a
# proper startup/shutdown lifecycle plus a background reminder sweep task.
from app.engagement import db as engagement_db
from app.engagement.exceptions import AppError as EngagementAppError
from app.engagement.routes import (
    allocations as engagement_allocations,
    approvals as engagement_approvals,
    expenses as engagement_expenses,
    me as engagement_me,
    notifications as engagement_notifications,
    portfolio as engagement_portfolio,
    reports as engagement_reports,
    time as engagement_time,
)
from app.engagement.services.reminders_service import run_reminder_sweep

engagement_log = logging.getLogger("engagement")


def _sweep_engagement_reminders_once() -> None:
    with engagement_db.connection() as conn:
        run_reminder_sweep(conn)


async def _engagement_reminder_loop() -> None:
    await asyncio.sleep(5)  # let the pool settle before the first sweep
    while True:
        try:
            await asyncio.to_thread(_sweep_engagement_reminders_once)
        except Exception:
            engagement_log.exception("engagement reminder sweep failed")
        await asyncio.sleep(30 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engagement_db.init_pool()
    reminder_task = asyncio.create_task(_engagement_reminder_loop())
    yield
    reminder_task.cancel()
    engagement_db.close_pool()


app = FastAPI(
    title="Cotelligent HRMS API",
    description="Complete HR Management System for Cotelligent",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(EngagementAppError)
async def _engagement_app_error_handler(request: Request, exc: EngagementAppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )


# Last-resort catch-all: without this, an unexpected error on an /api/engagement
# route (e.g. a race-condition constraint violation) falls through to FastAPI's
# default 500 body ({"detail": "Internal Server Error"}), which the engagement
# frontend's apiErrorMessage() can't parse (it reads error.error.message), so the
# user only ever sees a generic "could not be saved" toast with no real reason.
# This logs the actual traceback server-side and replies in the shape the
# frontend expects, so the failure is at least diagnosable next time.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    logging.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again.", "details": []}},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
try:
    base.Base.metadata.create_all(bind=engine)
except Exception as _exc:
    print(f"[startup] Could not init tables: {_exc}")

# Safe column migrations — add new optional columns to existing tables
def _run_column_migrations():
    from sqlalchemy import text
    _stmts = [
        "ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS team_email VARCHAR(255)",
        "ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500)",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
        "UPDATE leave_types SET is_active = TRUE WHERE is_active IS NULL",
        # Sync reporting_manager_name for any employee where manager_id is set but the name is missing
        "UPDATE employees SET reporting_manager_name = (SELECT m.first_name || ' ' || m.last_name FROM employees m WHERE m.id = employees.manager_id) WHERE manager_id IS NOT NULL AND (reporting_manager_name IS NULL OR reporting_manager_name = '')",

        # ── Leave engine: config-driven policy columns (Stage 1) ───────────
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS accrual_mode VARCHAR(20) DEFAULT 'none'",
        "UPDATE leave_types SET accrual_mode = 'none' WHERE accrual_mode IS NULL",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS accrual_amount DOUBLE PRECISION",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS max_balance DOUBLE PRECISION",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS carry_forward_limit DOUBLE PRECISION DEFAULT 0",
        "UPDATE leave_types SET carry_forward_limit = 0 WHERE carry_forward_limit IS NULL",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS encashment_limit DOUBLE PRECISION DEFAULT 0",
        "UPDATE leave_types SET encashment_limit = 0 WHERE encashment_limit IS NULL",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS feeds_bucket_type_id INTEGER REFERENCES leave_types(id)",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS lapses_at_year_end BOOLEAN DEFAULT FALSE",
        "UPDATE leave_types SET lapses_at_year_end = FALSE WHERE lapses_at_year_end IS NULL",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS day_count_mode VARCHAR(20) DEFAULT 'weekday'",
        "UPDATE leave_types SET day_count_mode = 'weekday' WHERE day_count_mode IS NULL",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS requires_admin_enable BOOLEAN DEFAULT FALSE",
        "UPDATE leave_types SET requires_admin_enable = FALSE WHERE requires_admin_enable IS NULL",
        "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS max_applications_per_year INTEGER",
        "ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS day_part VARCHAR(10) DEFAULT 'full'",
        "UPDATE leave_requests SET day_part = 'full' WHERE day_part IS NULL",
        # Idempotency guard for scheduler-driven balance rows — one row per employee/type/year
        "ALTER TABLE leave_balances ADD CONSTRAINT uq_leave_balance_period UNIQUE (employee_id, leave_type_id, year)",

        # ── Shift module: single-page Add Shift form columns ───────────────
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_margin BOOLEAN DEFAULT FALSE",
        "UPDATE shifts SET shift_margin = FALSE WHERE shift_margin IS NULL",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS core_working_hours BOOLEAN DEFAULT FALSE",
        "UPDATE shifts SET core_working_hours = FALSE WHERE core_working_hours IS NULL",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS weekend_basis VARCHAR(20) DEFAULT 'location'",
        "UPDATE shifts SET weekend_basis = 'location' WHERE weekend_basis IS NULL",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS provide_shift_allowance BOOLEAN DEFAULT FALSE",
        "UPDATE shifts SET provide_shift_allowance = FALSE WHERE provide_shift_allowance IS NULL",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS eligibility_criteria TEXT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS weekend_days TEXT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS half_working_day_half_weekend BOOLEAN DEFAULT FALSE",
        "UPDATE shifts SET half_working_day_half_weekend = FALSE WHERE half_working_day_half_weekend IS NULL",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS define_statutory_weekends BOOLEAN DEFAULT FALSE",
        "UPDATE shifts SET define_statutory_weekends = FALSE WHERE define_statutory_weekends IS NULL",

        # ── MFA (TOTP second factor) ────────────────────────────────────────
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE",
        "UPDATE employees SET mfa_enabled = FALSE WHERE mfa_enabled IS NULL",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64)",

        # ── Notifications: widen the bell's `type` CHECK to cover core HRMS
        # events (originally Associate-Engagement-only: timesheet/expense
        # submit/decision + weekend entries) ────────────────────────────────
        "ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check",
        """ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
           CHECK (type IN (
               'timesheet_submitted', 'timesheet_approved', 'timesheet_changes_requested',
               'expense_submitted', 'expense_approved', 'expense_rejected',
               'weekend_entry_logged', 'task_assigned',
               'leave_requested', 'leave_approved', 'leave_rejected',
               'announcement_posted', 'payslip_generated', 'payslip_paid',
               'shift_swap_requested', 'shift_swap_approved', 'shift_swap_rejected',
               'asset_assigned', 'asset_returned', 'asset_maintenance', 'asset_retired',
               'document_uploaded', 'policy_published',
               'performance_self_review_submitted', 'performance_review_completed'
           ))""",
    ]
    try:
        with engine.connect() as _conn:
            for _stmt in _stmts:
                # Each statement gets its own transaction so one failure (e.g. a
                # constraint that already exists from a prior run) can't abort the
                # shared Postgres transaction and silently skip every statement after it.
                try:
                    with _conn.begin():
                        _conn.execute(text(_stmt))
                except Exception:
                    pass
    except Exception as _e:
        print(f"[startup] Column migration skipped: {_e}")

_run_column_migrations()

# Sync the leave-type policy configuration (accrual rules, eligibility rules,
# opening/catch-up balances) into every configured database on startup — this
# is what keeps a database's leave engine from silently drifting out of sync
# with the target policy (e.g. a database that only ever got table/column
# migrations but never had its leave-type rows populated with policy values).
# Idempotent: see app/services/leave_policy_seed.py.
def _sync_leave_policy_everywhere():
    from app.services.leave_policy_seed import sync_leave_policy
    _session = SessionLocal()
    try:
        sync_leave_policy(_session)
    except Exception as _exc:
        print(f"[startup] Leave policy sync failed: {_exc}")
    finally:
        _session.close()

_sync_leave_policy_everywhere()

# One-time backfill: reserve balance for any leave request that was left
# pending under the old "deduct only on approval" model, so it behaves like
# a request applied under the new reserve-at-apply model. Idempotent — see
# reserve_leave_days()'s use of record_leave_transaction's reference
# uniqueness — so this is a no-op on every restart once a request has been
# backfilled once. A single request failing (e.g. balance no longer
# sufficient) doesn't block the rest.
def _backfill_pending_leave_reservations():
    from app.models.base import LeaveRequest
    from app.services.leave_calculation import reserve_leave_days
    _session = SessionLocal()
    try:
        _pending = _session.query(LeaveRequest).filter(LeaveRequest.status == "pending").all()
        for _leave in _pending:
            try:
                reserve_leave_days(_session, _leave)
                _session.commit()
            except ValueError:
                _session.rollback()
    except Exception as _exc:
        print(f"[startup] Pending-leave backfill failed: {_exc}")
    finally:
        _session.close()

_backfill_pending_leave_reservations()

# Start the leave engine's in-process scheduler (monthly accrual/reset, yearly
# allocation, year-end processing) — see app/core/scheduler.py.
from app.core.scheduler import start_scheduler
start_scheduler()

app.include_router(auth.router,             prefix="/api/auth",             tags=["Authentication"])
app.include_router(employees.router,        prefix="/api/employees",        tags=["Employees"])
app.include_router(orgchart.router,         prefix="/api/orgchart",         tags=["Org Chart"])
app.include_router(orgchart_editor.router,  prefix="/api/orgchart-editor",  tags=["Org Chart Editor"])
app.include_router(attendance.router,       prefix="/api/attendance",       tags=["Attendance"])
app.include_router(leave.router,            prefix="/api/leave",            tags=["Leave"])
app.include_router(payroll.router,          prefix="/api/payroll",          tags=["Payroll"])
app.include_router(performance.router,      prefix="/api/performance",      tags=["Performance"])
app.include_router(documents.router,        prefix="/api/documents",        tags=["Documents"])
app.include_router(departments.router,      prefix="/api/departments",      tags=["Departments"])
app.include_router(announcements.router,    prefix="/api/announcements",    tags=["Announcements"])
app.include_router(modules.router,          prefix="/api/modules",          tags=["Modules"])
app.include_router(assets.router,           prefix="/api/assets",           tags=["Assets"])
app.include_router(ai.router,               prefix="/api/ai",               tags=["AI Assistant"])
app.include_router(employee_profile.router, prefix="/api/employee-profiles",tags=["Employee Profile"])
app.include_router(user_management.router,  prefix="/api/user-management",  tags=["User Management"])
app.include_router(shift.router,            prefix="/api/shift",            tags=["Shift & Roster"])
app.include_router(policy.router,              prefix="/api/policy",              tags=["Policy & Handbook"])
app.include_router(travel.router,              prefix="/api/travel",              tags=["Travel"])
app.include_router(reimbursement.router,       prefix="/api/reimbursement",       tags=["Reimbursement"])
app.include_router(offboarding.router,         prefix="/api/offboarding",         tags=["Offboarding"])
app.include_router(insurance.router,           prefix="/api/insurance",           tags=["Insurance"])
app.include_router(asset_requisition.router,   prefix="/api/asset-requisition",   tags=["Asset Requisition"])
app.include_router(leave_tracker.router,       prefix="/api/leave-tracker",        tags=["Leave Tracker"])
app.include_router(alumni_sso.router,          prefix="/api/modules",              tags=["Modules"])

# Associate Engagement (Timesheet + PSA) — behind the "Associate Engagement" card
# on the HR Operation modules page. Auth is dev-hr's own (see app/engagement/deps.py).
app.include_router(engagement_me.router,            prefix="/api/engagement", tags=["Associate Engagement"])
app.include_router(engagement_portfolio.router,     prefix="/api/engagement", tags=["Associate Engagement"])
app.include_router(engagement_time.router,          prefix="/api/engagement", tags=["Associate Engagement"])
app.include_router(engagement_reports.router,       prefix="/api/engagement", tags=["Associate Engagement"])
app.include_router(engagement_approvals.router,     prefix="/api/engagement", tags=["Associate Engagement"])
app.include_router(engagement_allocations.router,   prefix="/api/engagement", tags=["Associate Engagement"])
app.include_router(engagement_expenses.router,      prefix="/api/engagement", tags=["Associate Engagement"])
app.include_router(engagement_notifications.router, prefix="/api/engagement", tags=["Associate Engagement"])


_upload_path = Path(settings.UPLOAD_DIR)
_upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_upload_path)), name="uploads")


@app.get("/")
def root():
    return {"message": "Cotelligent HRMS API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
