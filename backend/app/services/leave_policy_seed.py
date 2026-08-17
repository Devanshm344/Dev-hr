"""
Leave-type policy configuration — the single source of truth for which leave
types, accrual rules, and eligibility rules exist in every configured
database.

`sync_leave_policy(session)` is idempotent and DB-agnostic: it upserts leave
types by name, replaces eligibility rules, and backfills this year's opening
balances via the real scheduler jobs (leave_scheduler.py) — the same code
that runs on the monthly/yearly cron. Safe to call on every app startup for
every configured database (see main.py), and safe to re-run any time a
policy value changes.
"""
from datetime import date

from app.models.base import (
    LeaveType, LeaveBalance, Employee,
    LeaveAccrualModeEnum, LeaveDayCountModeEnum,
    LeaveTypeEligibilityRule, LeaveEligibilityRuleTypeEnum, LeaveEnablementRequest,
)
from app.services import leave_scheduler

LEAVE_TYPES_DATA = [
    # Ordered so leave_types[:3] (used by seed_dev_hr.py for random leave-request
    # seeding) lands on ordinary, frequently-taken leave types.
    dict(name="Sick Leave", code="SL", days_allowed=7, carry_forward=False, paid=True,
         description="Leave for illness and medical reasons — accrues 7/12 days per month, capped at 7.",
         accrual_mode=LeaveAccrualModeEnum.monthly_credit, accrual_amount=7 / 12,
         max_balance=7, lapses_at_year_end=True),
    dict(name="Earned Leaves", code="EL", days_allowed=15, carry_forward=True, paid=True,
         description="Accrues 15/12 days per month. At year end: up to 5 days carry forward, up to 5 "
                     "days are encashed, and any remainder transfers into the Leave Bucket.",
         accrual_mode=LeaveAccrualModeEnum.monthly_credit, accrual_amount=15 / 12,
         carry_forward_limit=5, encashment_limit=5, lapses_at_year_end=True),
    dict(name="Compensatory Off", code="CO", days_allowed=0, carry_forward=False, paid=True,
         description="Compensatory off for working on holidays/weekends — admin-allocated, no scheduler.",
         accrual_mode=LeaveAccrualModeEnum.none),
    dict(name="Loss-of-Pay", code="LOP", days_allowed=12, carry_forward=False, paid=False,
         description="Unpaid leave — 12 days allocated once per calendar year on Jan 1. Unused balance lapses.",
         accrual_mode=LeaveAccrualModeEnum.yearly_allocation, accrual_amount=12,
         max_balance=12, lapses_at_year_end=True),
    dict(name="Leave Bucket", code="LB", days_allowed=0, carry_forward=True, paid=True,
         description="Accumulates unused Earned Leave carried forward beyond the yearly limit. Max 30, never expires.",
         accrual_mode=LeaveAccrualModeEnum.none, max_balance=30, lapses_at_year_end=False),
    dict(name="Maternity Leave", code="ML", days_allowed=182, carry_forward=False, paid=True,
         description="182 calendar days (includes weekends and holidays) for female employees. Disabled by "
                     "default — requires admin approval to enable. Max 2 approved applications per year.",
         accrual_mode=LeaveAccrualModeEnum.none, accrual_amount=182,
         day_count_mode=LeaveDayCountModeEnum.calendar, requires_admin_enable=True,
         max_applications_per_year=2),
    dict(name="Paternity Leave", code="PatL", days_allowed=5, carry_forward=False, paid=True,
         description="5 calendar days for male employees. Disabled by default — requires admin approval "
                     "to enable. Max 2 approved applications per year.",
         accrual_mode=LeaveAccrualModeEnum.none, accrual_amount=5,
         day_count_mode=LeaveDayCountModeEnum.calendar, requires_admin_enable=True,
         max_applications_per_year=2),
    dict(name="WFH_Emp Quota", code="WFHE", days_allowed=3, carry_forward=False, paid=True,
         description="3 work-from-home requests per month for every employee. Resets monthly; unused expires.",
         accrual_mode=LeaveAccrualModeEnum.monthly_reset, accrual_amount=3),
    dict(name="WFH_Manager Quota", code="WFHM", days_allowed=0, carry_forward=True, paid=True,
         description="+1 work-from-home credit per month for every employee. Unlimited accumulation, never expires.",
         accrual_mode=LeaveAccrualModeEnum.monthly_credit, accrual_amount=1),
    dict(name="Business Travel", code="BTR", days_allowed=0, carry_forward=False, paid=True,
         description="Admin-allocated only — no automatic accrual or scheduler.",
         accrual_mode=LeaveAccrualModeEnum.none),
    dict(name="WFC (Work From Client)", code="WFC", days_allowed=0, carry_forward=False, paid=True,
         description="Admin-allocated only — no automatic accrual or scheduler.",
         accrual_mode=LeaveAccrualModeEnum.none),
]

ELIGIBILITY_DATA = [
    # Gender is the only real eligibility restriction in the target policy —
    # every other leave type (including both WFH quotas) is visible and
    # applicable to every employee, resolved purely via Employee.employee_id.
    ("Maternity Leave", LeaveEligibilityRuleTypeEnum.gender, "female"),
    ("Paternity Leave", LeaveEligibilityRuleTypeEnum.gender, "male"),
]


def sync_leave_policy(session, today: date = None):
    """Create or update the target leave-type policy set, its eligibility
    rules, and this year's opening balances (including catch-up accrual for
    any months already elapsed this year — e.g. when this runs for the first
    time against a database mid-year).

    Idempotent and safe to run against an already-seeded database on its own
    (e.g. to roll out a policy change without a full reseed): leave types are
    upserted by `name`, eligibility rules are replaced per leave type, and
    balances are created/credited via the real scheduler jobs — which are
    themselves idempotent via the leave_transactions ledger, so calling this
    twice never double-credits anything.
    """
    today = today or date.today()
    print("  Syncing leave-type policy configuration...")
    lt_objs = {}
    for spec in LEAVE_TYPES_DATA:
        # Matched by name, not code: some deployments already have a few of
        # these leave types (added earlier via the admin "create leave type"
        # UI) under different codes than this module's — matching by name
        # updates them in place instead of inserting duplicates.
        lt = session.query(LeaveType).filter(LeaveType.name == spec["name"]).first()
        if lt is None:
            lt = LeaveType(code=spec["code"])
            session.add(lt)
        lt.name = spec["name"]
        lt.days_allowed = spec["days_allowed"]
        lt.carry_forward = spec["carry_forward"]
        lt.paid = spec["paid"]
        lt.description = spec["description"]
        lt.is_active = True
        lt.accrual_mode = spec.get("accrual_mode", LeaveAccrualModeEnum.none)
        lt.accrual_amount = spec.get("accrual_amount")
        lt.max_balance = spec.get("max_balance")
        lt.carry_forward_limit = spec.get("carry_forward_limit", 0)
        lt.encashment_limit = spec.get("encashment_limit", 0)
        lt.lapses_at_year_end = spec.get("lapses_at_year_end", False)
        lt.day_count_mode = spec.get("day_count_mode", LeaveDayCountModeEnum.weekday)
        lt.requires_admin_enable = spec.get("requires_admin_enable", False)
        lt.max_applications_per_year = spec.get("max_applications_per_year")
        lt_objs[spec["name"]] = lt
    session.commit()

    # Earned Leaves' year-end overflow feeds the Leave Bucket type (self-referential FK)
    lt_objs["Earned Leaves"].feeds_bucket_type_id = lt_objs["Leave Bucket"].id
    session.commit()

    # ── Leave-type eligibility rules (config-driven, no hardcoded gender/manager checks) ──
    # This sync owns the full eligibility policy for every type in LEAVE_TYPES_DATA, so it
    # reconciles fully: rules matching ELIGIBILITY_DATA are upserted, and any pre-existing
    # rule for one of these types that's no longer in ELIGIBILITY_DATA is removed (e.g. a
    # restriction that's been lifted, like WFH_Manager Quota no longer being manager-only).
    target_keys = {(lt_objs[lt_name].id, rule_type) for lt_name, rule_type, _ in ELIGIBILITY_DATA}
    for lt_name, rule_type, rule_value in ELIGIBILITY_DATA:
        rule = session.query(LeaveTypeEligibilityRule).filter(
            LeaveTypeEligibilityRule.leave_type_id == lt_objs[lt_name].id,
            LeaveTypeEligibilityRule.rule_type == rule_type,
        ).first()
        if rule is None:
            session.add(LeaveTypeEligibilityRule(
                leave_type_id=lt_objs[lt_name].id, rule_type=rule_type, rule_value=rule_value,
            ))
        else:
            rule.rule_value = rule_value
    managed_type_ids = {lt.id for lt in lt_objs.values()}
    for rule in session.query(LeaveTypeEligibilityRule).filter(
        LeaveTypeEligibilityRule.leave_type_id.in_(managed_type_ids)
    ).all():
        if (rule.leave_type_id, rule.rule_type) not in target_keys:
            session.delete(rule)
    session.commit()

    # Admin-enable-required types (Maternity/Paternity) must have NO balance
    # unless a real enablement request was approved for that employee — clear
    # out any legacy/placeholder balance rows that predate this workflow
    # (e.g. from an older unconditional per-employee-per-type seed). Safe to
    # re-run: once real approvals exist, their balances are left alone.
    admin_gated_ids = [lt.id for lt in lt_objs.values() if lt.requires_admin_enable]
    if admin_gated_ids:
        approved_pairs = {
            (r.employee_id, r.leave_type_id)
            for r in session.query(LeaveEnablementRequest).filter(
                LeaveEnablementRequest.leave_type_id.in_(admin_gated_ids),
                LeaveEnablementRequest.status == "approved",
            ).all()
        }
        stale = session.query(LeaveBalance).filter(LeaveBalance.leave_type_id.in_(admin_gated_ids)).all()
        removed = 0
        for b in stale:
            if (b.employee_id, b.leave_type_id) not in approved_pairs:
                session.delete(b)
                removed += 1
        session.commit()
        if removed:
            print(f"  Removed {removed} legacy balance rows for admin-enable-required leave types.")

    leave_types = session.query(LeaveType).order_by(LeaveType.id).all()

    # ── Leave balances ───────────────────────────────────────────────────────
    # Reuse the actual scheduler jobs to create/credit balances, instead of
    # hand-rolling the same allocation math a second time here — this is the
    # same code path that runs in production on the 1st of each month and on
    # Jan 1, and it's a no-op for any employee/period already processed. The
    # monthly-accrual catch-up loop covers the case where this policy is
    # being synced for the first time mid-year (e.g. a database that didn't
    # have this scheduler running from Jan 1).
    current_year = today.year
    if session.query(Employee).count() > 0:
        leave_scheduler.run_year_initialization(session, current_year)
        leave_scheduler.run_yearly_allocation(session, current_year)
        for month in range(1, today.month + 1):
            leave_scheduler.run_monthly_accrual(session, current_year, month)
        leave_scheduler.run_monthly_reset(session, current_year, today.month)

    balance_rows = session.query(LeaveBalance).filter(LeaveBalance.year == current_year).all()
    balance_map = {(b.employee_id, b.leave_type_id): b for b in balance_rows}  # (employee_id str, leave_type_id) -> LeaveBalance
    print(f"  Synced {len(leave_types)} leave types; {len(balance_rows)} balance records for {current_year}.")
    return leave_types, balance_map
