"""
Leave engine scheduler jobs — monthly accrual/reset, yearly allocation, and
year-end processing (carry-forward / encashment / bucket transfer / lapse).

Every job is idempotent: it writes through record_leave_transaction(), which
is a no-op if a transaction with the same (employee, leave_type, type,
reference) already exists, so re-running a job — via a cron re-fire or the
admin manual-trigger endpoint — never double-credits, double-carries-forward,
or double-lapses a balance.
"""
from app.models.base import Employee, LeaveType, LeaveTransaction, LeaveAccrualModeEnum, LeaveTransactionTypeEnum
from app.services.leave_calculation import (
    get_or_create_leave_balance, record_leave_transaction, is_employee_eligible,
    bulk_eligible_employees, bulk_get_or_create_balances, bulk_already_applied,
)


def _eligible_employees(db, leave_type: LeaveType) -> list:
    employees = db.query(Employee).filter(Employee.status != "terminated").all()
    return [e for e in employees if is_employee_eligible(db, e, leave_type)]


# NOTE: run_year_initialization/run_yearly_allocation/run_monthly_accrual/
# run_monthly_reset run on every app startup for every configured database
# (see leave_policy_seed.sync_leave_policy), so they use the bulk_* primitives
# — a handful of queries total — instead of one query per employee per leave
# type, which made startup sync take thousands of round-trips.

def run_year_initialization(db, year: int) -> dict:
    """Ensure every eligible employee has a visible LeaveBalance row for `year`
    across every scheduler-managed active leave type, so nothing only appears
    once first credited. Admin-enable-required types (Maternity/Paternity) are
    skipped — their balance is created on enablement approval, not here."""
    reference = f"{year}"
    leave_types = [
        lt for lt in db.query(LeaveType).filter(LeaveType.is_active == True).all()
        if not lt.requires_admin_enable
    ]
    employees = db.query(Employee).filter(Employee.status != "terminated").all()
    eligible_map = bulk_eligible_employees(db, employees, leave_types)

    pairs = [(emp.employee_id, lt.id) for lt in leave_types for emp in eligible_map[lt.id]]
    balance_map = bulk_get_or_create_balances(db, pairs, year)
    applied = bulk_already_applied(
        db, (p[0] for p in pairs), (p[1] for p in pairs),
        LeaveTransactionTypeEnum.year_initialization, reference,
    )

    created = 0
    new_txns = []
    for emp_id, lt_id in pairs:
        if (emp_id, lt_id) in applied:
            continue
        balance = balance_map[(emp_id, lt_id)]
        new_txns.append(LeaveTransaction(
            employee_id=emp_id, leave_type_id=lt_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.year_initialization, amount=0,
            balance_after=balance.remaining_days, reference=reference,
        ))
        created += 1
    db.add_all(new_txns)
    db.commit()
    return {"job": "year_initialization", "year": year, "transactions_created": created}


def run_yearly_allocation(db, year: int) -> dict:
    """Yearly-allocation-mode types (LOP): set the full amount once at the
    start of the year."""
    reference = f"{year}"
    leave_types = db.query(LeaveType).filter(
        LeaveType.is_active == True,
        LeaveType.accrual_mode == LeaveAccrualModeEnum.yearly_allocation,
    ).all()
    employees = db.query(Employee).filter(Employee.status != "terminated").all()
    eligible_map = bulk_eligible_employees(db, employees, leave_types)

    pairs = [(emp.employee_id, lt.id) for lt in leave_types for emp in eligible_map[lt.id]]
    balance_map = bulk_get_or_create_balances(db, pairs, year)
    applied = bulk_already_applied(
        db, (p[0] for p in pairs), (p[1] for p in pairs),
        LeaveTransactionTypeEnum.yearly_allocation, reference,
    )

    amount_by_type = {lt.id: (lt.accrual_amount or 0) for lt in leave_types}
    created = 0
    new_txns = []
    for emp_id, lt_id in pairs:
        if (emp_id, lt_id) in applied:
            continue
        amount = amount_by_type[lt_id]
        new_txns.append(LeaveTransaction(
            employee_id=emp_id, leave_type_id=lt_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.yearly_allocation, amount=amount,
            balance_after=amount, reference=reference,
        ))
        balance = balance_map[(emp_id, lt_id)]
        balance.total_days = amount
        balance.used_days = 0
        balance.remaining_days = amount
        created += 1
    db.add_all(new_txns)
    db.commit()
    return {"job": "yearly_allocation", "year": year, "transactions_created": created}


def run_monthly_accrual(db, year: int, month: int) -> dict:
    """Monthly-credit-mode types (Sick, Earned Leave, WFH Manager): add
    accrual_amount, capped at max_balance if one is set."""
    reference = f"{year}-{month:02d}"
    leave_types = db.query(LeaveType).filter(
        LeaveType.is_active == True,
        LeaveType.accrual_mode == LeaveAccrualModeEnum.monthly_credit,
    ).all()
    employees = db.query(Employee).filter(Employee.status != "terminated").all()
    eligible_map = bulk_eligible_employees(db, employees, leave_types)

    pairs = [(emp.employee_id, lt.id) for lt in leave_types for emp in eligible_map[lt.id]]
    balance_map = bulk_get_or_create_balances(db, pairs, year)
    applied = bulk_already_applied(
        db, (p[0] for p in pairs), (p[1] for p in pairs),
        LeaveTransactionTypeEnum.monthly_credit, reference,
    )

    by_id = {lt.id: lt for lt in leave_types}
    created = 0
    new_txns = []
    for emp_id, lt_id in pairs:
        if (emp_id, lt_id) in applied:
            continue
        lt = by_id[lt_id]
        amount = lt.accrual_amount or 0
        balance = balance_map[(emp_id, lt_id)]
        new_total = balance.total_days + amount
        new_remaining = balance.remaining_days + amount
        if lt.max_balance is not None:
            overflow = max(0.0, new_remaining - lt.max_balance)
            new_total -= overflow
            new_remaining -= overflow
        new_txns.append(LeaveTransaction(
            employee_id=emp_id, leave_type_id=lt_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.monthly_credit, amount=amount,
            balance_after=new_remaining, reference=reference,
        ))
        balance.total_days = new_total
        balance.remaining_days = new_remaining
        created += 1
    db.add_all(new_txns)
    db.commit()
    return {"job": "monthly_accrual", "year": year, "month": month, "transactions_created": created}


def run_monthly_reset(db, year: int, month: int) -> dict:
    """Monthly-reset-mode types (WFH Employee): balance resets to
    accrual_amount every month regardless of what was used — unused doesn't
    carry forward."""
    reference = f"{year}-{month:02d}"
    leave_types = db.query(LeaveType).filter(
        LeaveType.is_active == True,
        LeaveType.accrual_mode == LeaveAccrualModeEnum.monthly_reset,
    ).all()
    employees = db.query(Employee).filter(Employee.status != "terminated").all()
    eligible_map = bulk_eligible_employees(db, employees, leave_types)

    pairs = [(emp.employee_id, lt.id) for lt in leave_types for emp in eligible_map[lt.id]]
    balance_map = bulk_get_or_create_balances(db, pairs, year)
    applied = bulk_already_applied(
        db, (p[0] for p in pairs), (p[1] for p in pairs),
        LeaveTransactionTypeEnum.monthly_reset, reference,
    )

    amount_by_type = {lt.id: (lt.accrual_amount or 0) for lt in leave_types}
    created = 0
    new_txns = []
    for emp_id, lt_id in pairs:
        if (emp_id, lt_id) in applied:
            continue
        amount = amount_by_type[lt_id]
        new_txns.append(LeaveTransaction(
            employee_id=emp_id, leave_type_id=lt_id, year=year,
            transaction_type=LeaveTransactionTypeEnum.monthly_reset, amount=amount,
            balance_after=amount, reference=reference,
        ))
        balance = balance_map[(emp_id, lt_id)]
        balance.total_days = amount
        balance.used_days = 0
        balance.remaining_days = amount
        created += 1
    db.add_all(new_txns)
    db.commit()
    return {"job": "monthly_reset", "year": year, "month": month, "transactions_created": created}


def run_year_end_processing(db, year: int) -> dict:
    """Process the ending `year` for every leave type with carry-forward,
    encashment, bucket-transfer, or lapse configured. Carry-forward and
    bucket-transfer credits are recorded against the *next* year's balance
    row; encashment and lapse reduce the ending year's row."""
    next_year = year + 1
    processed = 0
    leave_types = db.query(LeaveType).filter(LeaveType.is_active == True).all()
    by_id = {lt.id: lt for lt in leave_types}

    for lt in leave_types:
        has_year_end_rules = (
            (lt.carry_forward_limit or 0) > 0
            or (lt.encashment_limit or 0) > 0
            or lt.feeds_bucket_type_id
            or lt.lapses_at_year_end
        )
        if not has_year_end_rules:
            continue

        for emp in _eligible_employees(db, lt):
            current = get_or_create_leave_balance(db, emp.employee_id, lt.id, year)
            remaining = current.remaining_days

            carry_forward = min(remaining, lt.carry_forward_limit or 0)
            if carry_forward > 0:
                next_balance = get_or_create_leave_balance(db, emp.employee_id, lt.id, next_year)
                txn = record_leave_transaction(
                    db, employee_id=emp.employee_id, leave_type_id=lt.id, year=next_year,
                    transaction_type=LeaveTransactionTypeEnum.carry_forward, amount=carry_forward,
                    balance_after=next_balance.remaining_days + carry_forward,
                    reference=f"carry-forward:{year}",
                )
                if txn is not None:
                    next_balance.total_days += carry_forward
                    next_balance.remaining_days += carry_forward
                    remaining -= carry_forward
                    processed += 1

            encash = min(remaining, lt.encashment_limit or 0)
            if encash > 0:
                txn = record_leave_transaction(
                    db, employee_id=emp.employee_id, leave_type_id=lt.id, year=year,
                    transaction_type=LeaveTransactionTypeEnum.encashment, amount=-encash,
                    balance_after=remaining - encash, reference=f"encashment:{year}",
                )
                if txn is not None:
                    remaining -= encash
                    processed += 1

            bucket_type = by_id.get(lt.feeds_bucket_type_id) if lt.feeds_bucket_type_id else None
            if bucket_type is not None and remaining > 0:
                bucket_balance = get_or_create_leave_balance(db, emp.employee_id, bucket_type.id, next_year)
                bucket_space = max(0.0, (bucket_type.max_balance or 0) - bucket_balance.remaining_days)
                transfer = min(remaining, bucket_space)
                if transfer > 0:
                    txn = record_leave_transaction(
                        db, employee_id=emp.employee_id, leave_type_id=bucket_type.id, year=next_year,
                        transaction_type=LeaveTransactionTypeEnum.bucket_transfer, amount=transfer,
                        balance_after=bucket_balance.remaining_days + transfer,
                        reference=f"bucket-transfer:{year}",
                    )
                    if txn is not None:
                        bucket_balance.total_days += transfer
                        bucket_balance.remaining_days += transfer
                        remaining -= transfer
                        processed += 1

            if remaining > 0 and lt.lapses_at_year_end:
                txn = record_leave_transaction(
                    db, employee_id=emp.employee_id, leave_type_id=lt.id, year=year,
                    transaction_type=LeaveTransactionTypeEnum.lapse, amount=-remaining,
                    balance_after=0, reference=f"lapse:{year}",
                )
                if txn is not None:
                    remaining = 0
                    processed += 1

            current.remaining_days = remaining

    db.commit()
    return {"job": "year_end_processing", "year": year, "transactions_created": processed}
