"""
In-process APScheduler wiring for the leave engine's monthly/yearly jobs.

There is no other scheduler or worker process anywhere in this app — this is
the one place background jobs run, inside the same FastAPI process as
everything else (matching how this app has no separate worker deployment).
Each job function is idempotent on its own (see leave_scheduler.py), so a
missed tick, a manual re-run via the admin endpoint, or an app restart never
double-applies a credit.
"""
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.database import SessionLocal
from app.services import leave_scheduler

_scheduler = None


def _run_job(job_fn, *args, **kwargs):
    db = SessionLocal()
    try:
        job_fn(db, *args, **kwargs)
    except Exception as exc:
        print(f"[scheduler] {job_fn.__name__} failed: {exc}")
    finally:
        db.close()


def _monthly_job():
    today = date.today()
    _run_job(leave_scheduler.run_monthly_accrual, today.year, today.month)
    _run_job(leave_scheduler.run_monthly_reset, today.year, today.month)


def _new_year_job():
    today = date.today()
    _run_job(leave_scheduler.run_year_end_processing, today.year - 1)
    _run_job(leave_scheduler.run_year_initialization, today.year)
    _run_job(leave_scheduler.run_yearly_allocation, today.year)


def start_scheduler():
    """Start the background scheduler once per process. Safe to call multiple
    times — a second call is a no-op."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _monthly_job, CronTrigger(day=1, hour=0, minute=10),
        id="leave_monthly_job", replace_existing=True,
    )
    _scheduler.add_job(
        _new_year_job, CronTrigger(month=1, day=1, hour=0, minute=5),
        id="leave_new_year_job", replace_existing=True,
    )
    _scheduler.start()
