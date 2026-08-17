"""
Centralized leave-related calculation logic.

Leave day-counting and leave-balance arithmetic used to be duplicated across
leave.py and leave_tracker.py (and the LOP portion of a payslip's salary
math lived in payroll.py). It all lives here now so route handlers stay thin
and there is a single source of truth for how leave days and balances are
computed.
"""
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.base import (
    LeaveBalance, LeaveType, LeaveRequest, LeaveTransaction, LeaveTransactionTypeEnum,
    LeaveTypeEligibilityRule, Employee, Holiday,
)


def count_weekdays(start_date: date, end_date: date) -> int:
    """Number of weekdays (Mon-Fri) in the inclusive [start_date, end_date] range."""
    count = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:
            count += 1
        current += timedelta(days=1)
    return count


def has_sufficient_balance(balance: Optional[LeaveBalance], days: float) -> bool:
    """True if there's no tracked balance for this leave type, or enough remaining days."""
    return balance is None or balance.remaining_days >= days


def apply_leave_deduction(balance: Optional[LeaveBalance], days: float) -> None:
    """Deduct approved leave days from a LeaveBalance in place."""
    if balance is None:
        return
    balance.used_days += days
    balance.remaining_days -= days


def update_balance_fields(
    balance: LeaveBalance,
    total_days: Optional[float] = None,
    used_days: Optional[float] = None,
    remaining_days: Optional[float] = None,
) -> None:
    """Apply an admin's manual overrides to a LeaveBalance in place."""
    if total_days is not None:
        balance.total_days = total_days
    if used_days is not None:
        balance.used_days = used_days
    if remaining_days is not None:
        balance.remaining_days = remaining_days


def calculate_lop_amount(gross_salary: float, working_days: int, lop_days: float) -> float:
    """Loss-of-pay deduction amount for a payslip, based on the per-day salary rate."""
    per_day = gross_salary / working_days
    return per_day * lop_days


def get_leave_balance_overview(
    db: Session,
    employee: Employee,
    year: int,
) -> list[dict]:
    """Every active leave type applicable to this employee, zero-filled if no
    LeaveBalance row has been created for it yet.

    Single source of truth for "leave balance" views (self-service and admin)
    so a new leave type shows up everywhere as soon as it's marked active,
    instead of only appearing once a balance row happens to exist for it.
    Eligibility (gender, manager/non-manager) is config-driven via
    LeaveTypeEligibilityRule, not hardcoded — see is_employee_eligible().
    """
    leave_types = db.query(LeaveType).filter(LeaveType.is_active == True).all()

    balance_rows = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == employee.employee_id,
        LeaveBalance.year == year,
    ).all()
    balance_map = {b.leave_type_id: b for b in balance_rows}

    result = []
    for lt in leave_types:
        if not is_employee_eligible(db, employee, lt):
            continue
        b = balance_map.get(lt.id)
        result.append({
            "id": b.id if b else None,
            "leave_type_id": lt.id,
            "leave_type": lt.name,
            "total_days": b.total_days if b else 0,
            # Floored — "days used" is never meaningfully negative even if a
            # balance row was desynced by a manual correction upstream.
            "used_days": max(0.0, b.used_days) if b else 0,
            "remaining_days": b.remaining_days if b else 0,
            "year": year,
        })
    return result


# ── Eligibility (config-driven) ─────────────────────────────────────────────

def is_manager(db: Session, employee: Employee) -> bool:
    """True if anyone reports to this employee, via the existing Employee.manager_id
    hierarchy — the same relationship-driven check team-pending approvals already
    use, not a stored flag."""
    return db.query(Employee.id).filter(Employee.manager_id == employee.id).first() is not None


def is_employee_eligible(db: Session, employee: Employee, leave_type: LeaveType) -> bool:
    """Config-driven eligibility: reads LeaveTypeEligibilityRule rows for this
    leave type instead of a hardcoded name/gender mapping. No rule of a given
    kind means no restriction of that kind."""
    rules = db.query(LeaveTypeEligibilityRule).filter(
        LeaveTypeEligibilityRule.leave_type_id == leave_type.id
    ).all()
    for rule in rules:
        rule_type = rule.rule_type.value if hasattr(rule.rule_type, "value") else rule.rule_type
        if rule_type == "gender":
            if (employee.gender or "").strip().lower() != (rule.rule_value or "").strip().lower():
                return False
        elif rule_type == "manager_flag":
            required = (rule.rule_value or "").strip().lower() == "true"
            if is_manager(db, employee) != required:
                return False
    return True


# ── Balance / transaction primitives ────────────────────────────────────────

def get_or_create_leave_balance(
    db: Session, employee_id: str, leave_type_id: int, year: int, for_update: bool = False,
) -> LeaveBalance:
    """Single creation point for a LeaveBalance row — every allocation, accrual,
    and apply path goes through this instead of ad hoc queries, so the
    (employee, leave_type, year) row is never created twice.

    for_update=True row-locks an existing balance for the duration of the
    caller's transaction, so two concurrent read-modify-write mutations
    (e.g. two applications against the same balance) serialize instead of
    racing. Only mutation call sites should pass it — read-only callers
    (preview, balance overview) leave it False to avoid holding locks."""
    query = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.leave_type_id == leave_type_id,
        LeaveBalance.year == year,
    )
    if for_update:
        query = query.with_for_update()
    balance = query.first()
    if balance is None:
        balance = LeaveBalance(
            employee_id=employee_id, leave_type_id=leave_type_id, year=year,
            total_days=0, used_days=0, remaining_days=0,
        )
        db.add(balance)
        db.flush()
    return balance


def reserve_leave_days(db: Session, leave: LeaveRequest) -> None:
    """Reserve a leave request's days against its balance the moment the
    request exists (pending or otherwise) — applying for leave immediately
    consumes balance rather than waiting for approval. Row-locks the balance
    and re-validates sufficiency under that lock (the caller's earlier
    preview_leave() check is advisory/fast-fail only; this is the
    authoritative, race-safe check). Idempotent via record_leave_transaction's
    reference uniqueness, so it's safe to call again for an already-reserved
    request (used by the startup backfill for pre-existing pending requests).
    Raises ValueError if the balance is insufficient.
    """
    year = leave.start_date.year
    balance = get_or_create_leave_balance(db, leave.employee_id, leave.leave_type_id, year, for_update=True)
    if not has_sufficient_balance(balance, leave.days):
        raise ValueError(f"Insufficient leave balance. Available: {balance.remaining_days} days")
    txn = record_leave_transaction(
        db, employee_id=leave.employee_id, leave_type_id=leave.leave_type_id, year=year,
        transaction_type=LeaveTransactionTypeEnum.debit, amount=-leave.days,
        balance_after=balance.remaining_days - leave.days, reference=f"leave_request:{leave.id}",
        leave_request_id=leave.id, performed_by=None,
    )
    if txn is not None:
        apply_leave_deduction(balance, leave.days)


def cancel_pending_leave(db: Session, leave: LeaveRequest, actor_id: int) -> None:
    """Restore a pending leave request's reserved balance and mark it
    cancelled. Only valid for a still-pending request — its days were
    reserved by reserve_leave_days() at apply time, so cancelling must give
    them back to the same leave type they were taken from."""
    year = leave.start_date.year
    balance = get_or_create_leave_balance(db, leave.employee_id, leave.leave_type_id, year, for_update=True)
    txn = record_leave_transaction(
        db, employee_id=leave.employee_id, leave_type_id=leave.leave_type_id, year=year,
        transaction_type=LeaveTransactionTypeEnum.credit_reversal, amount=leave.days,
        balance_after=balance.remaining_days + leave.days, reference=f"leave_request:{leave.id}:cancel",
        leave_request_id=leave.id, performed_by=actor_id,
    )
    if txn is not None:
        reversed_days = min(leave.days, balance.used_days)
        balance.used_days -= reversed_days
        balance.remaining_days += reversed_days
    leave.status = "cancelled"


def record_leave_transaction(
    db: Session,
    *,
    employee_id: str,
    leave_type_id: int,
    year: int,
    transaction_type: LeaveTransactionTypeEnum,
    amount: float,
    balance_after: float,
    reference: str,
    leave_request_id: Optional[int] = None,
    performed_by: Optional[int] = None,
) -> Optional[LeaveTransaction]:
    """Insert a leave_transactions row. Returns None without writing anything if
    this exact (employee, leave_type, transaction_type, reference) was already
    recorded — this is what makes every scheduler job and approval path
    idempotent under a re-run, instead of each caller re-implementing the check."""
    already_applied = db.query(LeaveTransaction.id).filter(
        LeaveTransaction.employee_id == employee_id,
        LeaveTransaction.leave_type_id == leave_type_id,
        LeaveTransaction.transaction_type == transaction_type,
        LeaveTransaction.reference == reference,
    ).first()
    if already_applied is not None:
        return None
    txn = LeaveTransaction(
        employee_id=employee_id, leave_type_id=leave_type_id, year=year,
        transaction_type=transaction_type, amount=amount, balance_after=balance_after,
        reference=reference, leave_request_id=leave_request_id, performed_by=performed_by,
    )
    db.add(txn)
    db.flush()
    return txn


# ── Bulk primitives (scheduler jobs only) ───────────────────────────────────
# The single-row primitives above issue one query per employee, which is fine
# for request handlers acting on one employee at a time but turns the
# scheduler jobs — which act on every employee for every leave type, every
# time they run — into thousands of round-trips. These batch the same checks
# into O(1) queries regardless of employee/leave-type count.

def bulk_eligible_employees(db: Session, employees: list, leave_types: list) -> dict:
    """Same eligibility logic as is_employee_eligible, evaluated for every
    (employee, leave_type) pair using 2 queries total instead of one query
    per employee per leave type. Returns {leave_type_id: [eligible Employee, ...]}."""
    type_ids = [lt.id for lt in leave_types]
    rules_by_type: dict = {}
    if type_ids:
        for rule in db.query(LeaveTypeEligibilityRule).filter(
            LeaveTypeEligibilityRule.leave_type_id.in_(type_ids)
        ).all():
            rules_by_type.setdefault(rule.leave_type_id, []).append(rule)
    manager_ids = {
        row[0] for row in db.query(Employee.manager_id).filter(Employee.manager_id.isnot(None)).distinct().all()
    }

    result = {}
    for lt in leave_types:
        eligible = []
        lt_rules = rules_by_type.get(lt.id, [])
        for emp in employees:
            ok = True
            for rule in lt_rules:
                rule_type = rule.rule_type.value if hasattr(rule.rule_type, "value") else rule.rule_type
                if rule_type == "gender":
                    if (emp.gender or "").strip().lower() != (rule.rule_value or "").strip().lower():
                        ok = False
                        break
                elif rule_type == "manager_flag":
                    required = (rule.rule_value or "").strip().lower() == "true"
                    if (emp.id in manager_ids) != required:
                        ok = False
                        break
            if ok:
                eligible.append(emp)
        result[lt.id] = eligible
    return result


def bulk_get_or_create_balances(db: Session, pairs, year: int) -> dict:
    """Batch version of get_or_create_leave_balance for a set of (employee_id,
    leave_type_id) pairs — one SELECT to load what exists, one bulk INSERT for
    what's missing, instead of a query per pair."""
    pairs = list({(emp_id, lt_id) for emp_id, lt_id in pairs})
    if not pairs:
        return {}
    employee_ids = {p[0] for p in pairs}
    leave_type_ids = {p[1] for p in pairs}
    existing = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id.in_(employee_ids),
        LeaveBalance.leave_type_id.in_(leave_type_ids),
        LeaveBalance.year == year,
    ).all()
    balance_map = {(b.employee_id, b.leave_type_id): b for b in existing}
    new_balances = []
    for emp_id, lt_id in pairs:
        key = (emp_id, lt_id)
        if key not in balance_map:
            balance = LeaveBalance(
                employee_id=emp_id, leave_type_id=lt_id, year=year,
                total_days=0, used_days=0, remaining_days=0,
            )
            new_balances.append(balance)
            balance_map[key] = balance
    if new_balances:
        db.add_all(new_balances)
        db.flush()
    return balance_map


def bulk_already_applied(db: Session, employee_ids, leave_type_ids, transaction_type, reference) -> set:
    """Batch version of the idempotency check inside record_leave_transaction:
    returns the {(employee_id, leave_type_id)} pairs that already have a
    transaction for this (transaction_type, reference), in one query."""
    employee_ids = list(set(employee_ids))
    leave_type_ids = list(set(leave_type_ids))
    if not employee_ids or not leave_type_ids:
        return set()
    rows = db.query(LeaveTransaction.employee_id, LeaveTransaction.leave_type_id).filter(
        LeaveTransaction.employee_id.in_(employee_ids),
        LeaveTransaction.leave_type_id.in_(leave_type_ids),
        LeaveTransaction.transaction_type == transaction_type,
        LeaveTransaction.reference == reference,
    ).all()
    return {(row[0], row[1]) for row in rows}


# ── Approval (single mutation path for both approval endpoints) ────────────

def process_leave_approval(
    db: Session,
    leave: LeaveRequest,
    actor_id: int,
    status: str,
    rejection_reason: Optional[str] = None,
) -> LeaveRequest:
    """Single mutation path for approving/rejecting a leave request, shared by
    the self-service and HR-ops approval endpoints. Balance is already
    reserved at apply time (see reserve_leave_days()), so approving a request
    is a status-only change — it does not touch LeaveBalance. Rejecting
    restores the reservation back to the same leave type. Refuses to
    re-decide a request that's already been decided (idempotent under a
    duplicate call/retry). Raises ValueError on an already-decided request —
    callers translate that into their own HTTP error.
    """
    from datetime import datetime

    if leave.status != "pending":
        raise ValueError(f"This leave request has already been {leave.status}.")

    year = leave.start_date.year

    leave.status = status
    leave.approved_by = actor_id
    leave.approved_at = datetime.now()
    leave.rejection_reason = rejection_reason

    if status == "approved":
        # No balance mutation — already reserved at apply time. Audit-only
        # marker so the ledger records when/by whom it was decided.
        balance = get_or_create_leave_balance(db, leave.employee_id, leave.leave_type_id, year)
        record_leave_transaction(
            db, employee_id=leave.employee_id, leave_type_id=leave.leave_type_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.approval, amount=0,
            balance_after=balance.remaining_days, reference=f"leave_request:{leave.id}:approve",
            leave_request_id=leave.id, performed_by=actor_id,
        )
    elif status == "rejected":
        balance = get_or_create_leave_balance(db, leave.employee_id, leave.leave_type_id, year, for_update=True)
        txn = record_leave_transaction(
            db, employee_id=leave.employee_id, leave_type_id=leave.leave_type_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.credit_reversal, amount=leave.days,
            balance_after=balance.remaining_days + leave.days, reference=f"leave_request:{leave.id}:reject",
            leave_request_id=leave.id, performed_by=actor_id,
        )
        if txn is not None:
            reversed_days = min(leave.days, balance.used_days)
            balance.used_days -= reversed_days
            balance.remaining_days += reversed_days
    return leave


def override_leave_decision(
    db: Session,
    leave: LeaveRequest,
    actor_id: int,
    new_status: str,
) -> LeaveRequest:
    """Admin-only correction path for a leave request that has ALREADY been
    decided. Distinct from process_leave_approval(), which is reserved for
    deciding a still-pending request and refuses to touch an already-decided
    one. Reverses or (re)applies the balance ledger entry so LeaveBalance
    stays consistent with the corrected status.
    """
    from datetime import datetime

    if leave.status not in ("approved", "rejected"):
        raise ValueError("Only an already-decided (approved or rejected) leave request can be overridden.")
    if new_status not in ("approved", "rejected"):
        raise ValueError("Status must be 'approved' or 'rejected'.")
    if new_status == leave.status:
        raise ValueError(f"This leave request is already {leave.status}.")

    year = leave.start_date.year
    balance = get_or_create_leave_balance(db, leave.employee_id, leave.leave_type_id, year)

    # Counter-based reference (not a fixed ":override" suffix) so repeated
    # flip-flops each get a distinct (transaction_type, reference) pair —
    # record_leave_transaction() is idempotent per that pair, so a fixed
    # suffix would silently no-op (and desync the balance) on a 3rd override.
    override_seq = db.query(LeaveTransaction).filter(
        LeaveTransaction.leave_request_id == leave.id,
        LeaveTransaction.reference.like(f"leave_request:{leave.id}:override%"),
    ).count()
    reference = f"leave_request:{leave.id}:override:{override_seq + 1}"

    if leave.status == "approved" and new_status == "rejected":
        txn = record_leave_transaction(
            db, employee_id=leave.employee_id, leave_type_id=leave.leave_type_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.credit_reversal, amount=leave.days,
            balance_after=balance.remaining_days + leave.days, reference=reference,
            leave_request_id=leave.id, performed_by=actor_id,
        )
        if txn is not None:
            # Never reverse more than what's actually recorded as used — if the
            # balance was hand-corrected (admin balance edit) since this leave
            # was approved, a full reversal would drive used_days negative.
            reversed_days = min(leave.days, balance.used_days)
            balance.used_days -= reversed_days
            balance.remaining_days += reversed_days

    elif leave.status == "rejected" and new_status == "approved":
        if not has_sufficient_balance(balance, leave.days):
            raise ValueError(f"Insufficient leave balance. Available: {balance.remaining_days} days")
        txn = record_leave_transaction(
            db, employee_id=leave.employee_id, leave_type_id=leave.leave_type_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.debit, amount=-leave.days,
            balance_after=balance.remaining_days - leave.days, reference=reference,
            leave_request_id=leave.id, performed_by=actor_id,
        )
        if txn is not None:
            apply_leave_deduction(balance, leave.days)

    leave.status = new_status
    leave.approved_by = actor_id
    leave.approved_at = datetime.now()
    if new_status == "approved":
        leave.rejection_reason = None  # stale once no longer rejected

    return leave


# ── Day counting (leave-type-aware) ─────────────────────────────────────────

def calculate_leave_days(
    db: Session,
    leave_type: LeaveType,
    start_date_: date,
    end_date_: date,
    day_part: str = "full",
    region: str = "India",
) -> float:
    """Leave-type-aware day count. weekday mode (default) excludes weekends and
    the requesting employee's own office holidays (region, matching
    Employee.country — each office has its own calendar); calendar mode counts
    every day inclusive of weekends and holidays (e.g. Maternity Leave).
    Half-day only applies to a single-day request and halves the result. Wraps
    count_weekdays() rather than duplicating its logic."""
    mode = leave_type.day_count_mode
    mode = mode.value if hasattr(mode, "value") else (mode or "weekday")

    if mode == "calendar":
        days = float((end_date_ - start_date_).days + 1)
    else:
        days = float(count_weekdays(start_date_, end_date_))
        if days > 0:
            holidays_in_range = db.query(Holiday).filter(
                Holiday.date >= start_date_, Holiday.date <= end_date_,
                Holiday.region == region, Holiday.holiday_type == "public",
            ).all()
            for h in holidays_in_range:
                if h.date.weekday() < 5:
                    days -= 1

    if day_part == "half" and start_date_ == end_date_ and days > 0:
        days = days / 2
    return days


# ── Leave Preview (single calculation path for preview + apply) ────────────

def preview_leave(
    db: Session,
    employee: Employee,
    leave_type: LeaveType,
    start_date_: date,
    end_date_: date,
    day_part: str = "full",
    as_of: Optional[date] = None,
) -> dict:
    """Single, non-mutating calculation path used by both the Leave Preview API
    and Apply Leave — computes the requested days, projects the balance after
    booking, and decides whether the request should be allowed. No DB writes."""
    as_of = as_of or date.today()
    year = start_date_.year

    def _blocked(message: str) -> dict:
        return {
            "available_balance": 0, "current_booking": 0, "balance_after_booking": 0,
            "estimated_year_end_balance": 0, "allow_apply": False, "message": message,
        }

    if end_date_ < start_date_:
        return _blocked("End date cannot be before start date.")

    if not is_employee_eligible(db, employee, leave_type):
        return _blocked(f"{leave_type.name} is not available for your profile.")

    if leave_type.requires_admin_enable:
        has_balance = db.query(LeaveBalance.id).filter(
            LeaveBalance.employee_id == employee.employee_id,
            LeaveBalance.leave_type_id == leave_type.id,
            LeaveBalance.year == year,
        ).first() is not None
        if not has_balance:
            return _blocked(f"{leave_type.name} must be enabled by an admin before it can be applied for.")

    if leave_type.max_applications_per_year is not None:
        approved_count = db.query(LeaveRequest.id).filter(
            LeaveRequest.employee_id == employee.employee_id,
            LeaveRequest.leave_type_id == leave_type.id,
            LeaveRequest.status == "approved",
            func.extract("year", LeaveRequest.start_date) == year,
        ).count()
        if approved_count >= leave_type.max_applications_per_year:
            return _blocked(
                f"Maximum {leave_type.max_applications_per_year} approved "
                f"{leave_type.name} applications per year reached."
            )

    current_booking = calculate_leave_days(
        db, leave_type, start_date_, end_date_, day_part, region=employee.country or "India",
    )
    balance = get_or_create_leave_balance(db, employee.employee_id, leave_type.id, year)
    available_balance = balance.remaining_days
    balance_after_booking = available_balance - current_booking

    accrual_mode = leave_type.accrual_mode
    accrual_mode = accrual_mode.value if hasattr(accrual_mode, "value") else accrual_mode
    if accrual_mode == "monthly_credit" and leave_type.accrual_amount:
        remaining_months = max(0, 12 - as_of.month)
        estimated_year_end_balance = balance_after_booking + (remaining_months * leave_type.accrual_amount)
        if leave_type.max_balance is not None:
            estimated_year_end_balance = min(estimated_year_end_balance, leave_type.max_balance)
    else:
        estimated_year_end_balance = balance_after_booking

    allow_apply = balance_after_booking >= 0
    message = None if allow_apply else f"Leave balance has exceeded as on {as_of.strftime('%d-%b-%Y')}."

    return {
        "available_balance": available_balance,
        "current_booking": current_booking,
        "balance_after_booking": balance_after_booking,
        "estimated_year_end_balance": estimated_year_end_balance,
        "allow_apply": allow_apply,
        "message": message,
    }
