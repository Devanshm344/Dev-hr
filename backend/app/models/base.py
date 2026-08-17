from sqlalchemy import Column, Integer, String, DateTime, Date, Float, Boolean, Text, ForeignKey, Enum as SAEnum, Time, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class AssetCategoryEnum(str, enum.Enum):
    laptop = "laptop"
    mobile_phone = "mobile_phone"
    access_card = "access_card"
    monitor = "monitor"
    vehicle = "vehicle"
    furniture = "furniture"
    other = "other"


class AssetStatusEnum(str, enum.Enum):
    available = "available"
    assigned = "assigned"
    maintenance = "maintenance"
    retired = "retired"


class AssetEventEnum(str, enum.Enum):
    purchased = "purchased"
    assigned = "assigned"
    returned = "returned"
    maintenance_sent = "maintenance_sent"
    maintenance_returned = "maintenance_returned"
    retired = "retired"

# System role (Employee / Admin / Super Admin) has a single home: the plain
# string column UserRole.system_role below. It is not an enum on any other
# table — see get_effective_role() in app/core/security.py, which is the only
# correct way to resolve a person's access level.

class StatusEnum(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    on_leave = "on_leave"
    terminated = "terminated"

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, index=True)       # EmployeeID
    first_name = Column(String(100), nullable=False)                 # First Name
    last_name = Column(String(100), nullable=False)                  # Last Name
    email = Column(String(255), unique=True, index=True, nullable=False)  # Email ID
    mobile_phone = Column(String(30))                                # Mobile Phone
    personal_email = Column(String(255))                             # Personal Email
    extension = Column(String(20))                                   # Extension
    work_phone = Column(String(30))                                  # Work phone
    hashed_password = Column(String(255), nullable=False)
    job_role = Column(String(100))                                   # Role (from CSV: Team member, Manager, etc.)
    employment_type = Column(String(50))                             # Employee type (Permanent, On Contract, Temporary)
    status = Column(SAEnum(StatusEnum), default=StatusEnum.active)   # Employee status
    onboarding_status = Column(String(50))                           # Onboarding Status
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)  # Department
    sub_department = Column(String(100))                             # Sub Department
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    reporting_manager_name = Column(String(200))                     # Reporting Manager (text)
    title = Column(String(200))                                      # Title (job title)
    job_level = Column(String(100))                                  # Job Level
    work_location = Column(String(200))                              # Work Location
    date_of_joining = Column(Date)                                   # Date of joining / Rehire Date
    date_of_birth = Column(Date)                                     # Birth Date
    date_of_exit = Column(Date)                                      # Date of exit
    last_working_day = Column(Date)                                  # Last Working Day
    probation_end_date = Column(Date)                                # Probation Ends on
    exit_reason = Column(Text)                                       # Exit Reason
    gender = Column(String(20))                                      # Gender
    blood_group = Column(String(20))                                 # Blood group
    marital_status = Column(String(30))                              # Marital status
    father_name = Column(String(200))                                # Father Name
    about_me = Column(Text)                                          # About Me
    source_of_hire = Column(String(100))                             # Source of hire
    present_address = Column(Text)                                   # Present Address
    permanent_address = Column(Text)                                 # Permanent Address
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100), default="India")
    # IANA zone for this employee's office — one per office today (Hyderabad/
    # Austin/Toronto), not derived from `country` since a country can span
    # multiple zones in general. Drives attendance day-boundaries and any
    # "employee's own local time" display (last login, check-in/out).
    timezone = Column(String(50), nullable=False, default="Asia/Kolkata")
    pincode = Column(String(10))
    emergency_contact_primary_name = Column(String(200))             # Emergency contact Name - Primary
    emergency_contact_primary_number = Column(String(30))            # Emergency Contact Number - Primary
    emergency_contact_secondary_name = Column(String(200))           # Emergency Contact Name - Secondary
    emergency_contact_secondary_number = Column(String(30))          # Emergency Contact Number - Secondary
    profile_picture = Column(String(500))                            # Photo
    primary_skill_set = Column(Text)                                 # Primary Skill Set
    secondary_skill_set = Column(Text)                               # Secondary Skill Set
    other_skills = Column(Text)                                      # Other Skills
    total_experience = Column(String(100))                           # Total Experience
    current_project = Column(String(200))                            # Current Project
    pan_number = Column(String(20))                                  # PAN Number
    aadhar_number = Column(String(25))                               # Aadhar Number
    bank_account_number = Column(String(30))                         # Bank Account Number
    bank_name = Column(String(100))                                  # Bank Name
    ifsc_code = Column(String(20))                                   # IFSC Code
    bank_account_holder_name = Column(String(200))                   # Name As Appears in Bank Account
    passport_number = Column(String(30))                             # Passport Number
    passport_valid_from = Column(Date)                               # Passport Valid From
    passport_valid_to = Column(Date)                                 # Passport Valid To
    base_salary = Column(Float, default=0)
    mfa_enabled = Column(Boolean, default=False)                      # TOTP second factor active
    mfa_secret = Column(String(64), nullable=True)                    # base32 TOTP secret (see security note below)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    manager = relationship("Employee", remote_side=[id], foreign_keys=[manager_id], backref="subordinates")
    attendance_records = relationship("Attendance", back_populates="employee", foreign_keys="Attendance.employee_id")
    leave_requests = relationship("LeaveRequest", back_populates="employee", foreign_keys="LeaveRequest.employee_id")
    payslips = relationship("Payslip", back_populates="employee", foreign_keys="Payslip.employee_id")
    performance_reviews = relationship("PerformanceReview", back_populates="employee", foreign_keys="PerformanceReview.employee_id")
    documents = relationship("Document", back_populates="employee", foreign_keys="Document.employee_id")


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(20), unique=True)
    description = Column(Text)
    head_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employees = relationship("Employee", back_populates="department", foreign_keys="Employee.department_id")
    head = relationship("Employee", foreign_keys=[head_id])


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(DateTime(timezone=True))
    check_out = Column(DateTime(timezone=True))
    work_hours = Column(Float, default=0)
    status = Column(String(20), default="present")
    notes = Column(Text)
    location = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="attendance_records", foreign_keys=[employee_id])


class LeaveAccrualModeEnum(str, enum.Enum):
    none = "none"                        # admin-allocated only (Business Travel, WFC, Leave Bucket)
    monthly_credit = "monthly_credit"    # e.g. Sick, Earned Leave, WFH Manager
    monthly_reset = "monthly_reset"      # e.g. WFH Employee
    yearly_allocation = "yearly_allocation"  # e.g. LOP


class LeaveDayCountModeEnum(str, enum.Enum):
    weekday = "weekday"    # Mon-Fri, holidays excluded
    calendar = "calendar"  # every calendar day, incl. weekends/holidays (e.g. Maternity)


class LeaveDayPartEnum(str, enum.Enum):
    full = "full"
    half = "half"


class LeaveEligibilityRuleTypeEnum(str, enum.Enum):
    gender = "gender"
    manager_flag = "manager_flag"


class LeaveTransactionTypeEnum(str, enum.Enum):
    yearly_allocation = "YEARLY_ALLOCATION"
    monthly_credit = "MONTHLY_CREDIT"
    monthly_reset = "MONTHLY_RESET"
    debit = "DEBIT"
    credit_reversal = "CREDIT_REVERSAL"
    carry_forward = "CARRY_FORWARD"
    encashment = "ENCASHMENT"
    bucket_transfer = "BUCKET_TRANSFER"
    lapse = "LAPSE"
    approval = "APPROVAL"
    rejection = "REJECTION"
    year_initialization = "YEAR_INITIALIZATION"
    admin_adjustment = "ADMIN_ADJUSTMENT"


class LeaveEnablementStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class LeaveType(Base):
    __tablename__ = "leave_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True)
    days_allowed = Column(Integer, default=0)
    carry_forward = Column(Boolean, default=False)
    paid = Column(Boolean, default=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)

    # ── Policy configuration (config-driven leave engine) ──────────────────
    accrual_mode = Column(SAEnum(LeaveAccrualModeEnum, name="leave_accrual_mode_enum"),
                           default=LeaveAccrualModeEnum.none, nullable=False)
    accrual_amount = Column(Float, nullable=True)          # monthly credit / monthly reset target / yearly allocation
    max_balance = Column(Float, nullable=True)              # hard cap after credit; null = unlimited
    carry_forward_limit = Column(Float, default=0)          # year-end carry-forward cap
    encashment_limit = Column(Float, default=0)             # year-end encashment cap
    feeds_bucket_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=True)  # EL -> Leave Bucket
    lapses_at_year_end = Column(Boolean, default=False)
    day_count_mode = Column(SAEnum(LeaveDayCountModeEnum, name="leave_day_count_mode_enum"),
                             default=LeaveDayCountModeEnum.weekday, nullable=False)
    requires_admin_enable = Column(Boolean, default=False)  # e.g. Maternity/Paternity
    max_applications_per_year = Column(Integer, nullable=True)

    feeds_bucket_type = relationship("LeaveType", remote_side=[id], foreign_keys=[feeds_bucket_type_id])


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance_period"),
    )
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    year = Column(Integer)
    total_days = Column(Float, default=0)
    used_days = Column(Float, default=0)
    remaining_days = Column(Float, default=0)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Float, default=0)
    day_part = Column(SAEnum(LeaveDayPartEnum, name="leave_day_part_enum"),
                       default=LeaveDayPartEnum.full, nullable=False)
    reason = Column(Text)
    team_email = Column(String(255), nullable=True)
    attachment_url = Column(String(500), nullable=True)
    status = Column(String(20), default="pending")
    approved_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="leave_requests", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType", foreign_keys=[leave_type_id])
    approver = relationship("Employee", foreign_keys=[approved_by])


class LeaveTypeEligibilityRule(Base):
    """Config-driven leave-type eligibility (replaces hardcoded gender/manager checks).

    Absence of a rule row for a leave type means "no restriction" of that kind.
    """
    __tablename__ = "leave_type_eligibility_rules"
    __table_args__ = (
        UniqueConstraint("leave_type_id", "rule_type", name="uq_leave_eligibility_rule"),
    )
    id = Column(Integer, primary_key=True, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    rule_type = Column(SAEnum(LeaveEligibilityRuleTypeEnum, name="leave_eligibility_rule_type_enum"), nullable=False)
    rule_value = Column(String(50), nullable=False)  # "female"/"male" for gender; "true"/"false" for manager_flag
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    leave_type = relationship("LeaveType", foreign_keys=[leave_type_id])


class LeaveTransaction(Base):
    """Audit ledger for every leave-balance mutation. Single source of truth for
    what changed, why, and whether a scheduler job already ran for a given period —
    the (employee_id, leave_type_id, transaction_type, reference) uniqueness is what
    makes every job idempotent under a re-run.
    """
    __tablename__ = "leave_transactions"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", "transaction_type", "reference",
                          name="uq_leave_txn_idempotency"),
    )
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    year = Column(Integer, nullable=False, index=True)
    transaction_type = Column(SAEnum(LeaveTransactionTypeEnum, name="leave_transaction_type_enum"), nullable=False)
    amount = Column(Float, nullable=False)          # signed: positive = credit, negative = debit
    balance_after = Column(Float, nullable=False)
    reference = Column(String(200), nullable=False)  # idempotency key, e.g. "2026-08" or "leave_request:123"
    leave_request_id = Column(Integer, ForeignKey("leave_requests.id"), nullable=True)
    performed_by = Column(Integer, ForeignKey("employees.id"), nullable=True)  # null = system/scheduler
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType", foreign_keys=[leave_type_id])
    leave_request = relationship("LeaveRequest", foreign_keys=[leave_request_id])
    performer = relationship("Employee", foreign_keys=[performed_by])


class LeaveEnablementRequest(Base):
    """Self-service request to enable a requires_admin_enable leave type
    (Maternity/Paternity) for an employee, pending admin approval."""
    __tablename__ = "leave_enablement_requests"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("employees.employee_id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    status = Column(SAEnum(LeaveEnablementStatusEnum, name="leave_enablement_status_enum"),
                     default=LeaveEnablementStatusEnum.pending, nullable=False)
    reason = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType", foreign_keys=[leave_type_id])
    reviewer = relationship("Employee", foreign_keys=[reviewed_by])


class Payslip(Base):
    __tablename__ = "payslips"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month = Column(Integer)
    year = Column(Integer)
    basic_salary = Column(Float, default=0)
    hra = Column(Float, default=0)
    special_allowance = Column(Float, default=0)
    transport_allowance = Column(Float, default=0)
    medical_allowance = Column(Float, default=0)
    gross_salary = Column(Float, default=0)
    pf_deduction = Column(Float, default=0)
    professional_tax = Column(Float, default=0)
    tds = Column(Float, default=0)
    other_deductions = Column(Float, default=0)
    total_deductions = Column(Float, default=0)
    net_salary = Column(Float, default=0)
    working_days = Column(Integer, default=0)
    present_days = Column(Integer, default=0)
    lop_days = Column(Float, default=0)
    status = Column(String(20), default="draft")
    payment_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="payslips", foreign_keys=[employee_id])


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    review_period = Column(String(50))
    review_type = Column(String(30))
    goals_rating = Column(Float)
    skills_rating = Column(Float)
    behavior_rating = Column(Float)
    overall_rating = Column(Float)
    strengths = Column(Text)
    improvements = Column(Text)
    goals_next_period = Column(Text)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="performance_reviews", foreign_keys=[employee_id])
    reviewer = relationship("Employee", foreign_keys=[reviewer_id])


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    title = Column(String(200), nullable=False)
    document_type = Column(String(50))
    file_path = Column(String(500))
    file_name = Column(String(200))
    file_size = Column(Integer)
    uploaded_by = Column(Integer, ForeignKey("employees.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="documents", foreign_keys=[employee_id])


class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50))
    priority = Column(String(20), default="normal")
    published_by = Column(Integer, ForeignKey("employees.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))

    publisher = relationship("Employee", foreign_keys=[published_by])


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    asset_code = Column(String(20), unique=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(SAEnum(AssetCategoryEnum), nullable=False)
    serial_number = Column(String(100))
    purchase_date = Column(Date)
    purchase_cost = Column(Float)
    vendor = Column(String(100))
    warranty_expiry = Column(Date)
    status = Column(SAEnum(AssetStatusEnum), default=AssetStatusEnum.available)
    current_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    current_employee = relationship("Employee", foreign_keys=[current_employee_id])
    assignments = relationship("AssetAssignment", back_populates="asset", order_by="AssetAssignment.event_date")


class AssetAssignment(Base):
    __tablename__ = "asset_assignments"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    event_type = Column(SAEnum(AssetEventEnum), nullable=False)
    event_date = Column(Date, nullable=False)
    notes = Column(Text)
    performed_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="assignments")
    employee = relationship("Employee", foreign_keys=[employee_id])
    performer = relationship("Employee", foreign_keys=[performed_by])


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])


class ShiftTypeEnum(str, enum.Enum):
    morning = "morning"
    evening = "evening"
    night = "night"
    general = "general"
    rotational = "rotational"


class ShiftSwapStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Shift(Base):
    __tablename__ = "shifts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    shift_type = Column(SAEnum(ShiftTypeEnum), default=ShiftTypeEnum.general)
    start_time = Column(String(10), nullable=False)   # "09:00"
    end_time = Column(String(10), nullable=False)     # "18:00"
    color = Column(String(20), default="#6366f1")
    description = Column(Text)
    grace_period_minutes = Column(Integer, default=15)
    is_night_shift = Column(Boolean, default=False)
    shift_margin = Column(Boolean, default=False)
    core_working_hours = Column(Boolean, default=False)
    weekend_basis = Column(String(20), default="location")   # "location" | "shift"
    provide_shift_allowance = Column(Boolean, default=False)
    eligibility_criteria = Column(Text)   # JSON string: {"scope": "all"|"department", "department_ids": [...]}
    weekend_days = Column(Text)           # JSON string: {"sunday": {"all": bool, "1": bool, ...}, ...}
    half_working_day_half_weekend = Column(Boolean, default=False)
    define_statutory_weekends = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee_mappings = relationship("EmployeeShiftMapping", back_populates="shift")
    creator = relationship("Employee", foreign_keys=[created_by])


class EmployeeShiftMapping(Base):
    __tablename__ = "employee_shift_mappings"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    assigned_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
    shift = relationship("Shift", back_populates="employee_mappings")
    assigner = relationship("Employee", foreign_keys=[assigned_by])


class ShiftSwapRequest(Base):
    __tablename__ = "shift_swap_requests"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    requested_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    swap_date = Column(Date, nullable=False)
    requester_shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    requested_shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    reason = Column(Text)
    status = Column(SAEnum(ShiftSwapStatusEnum), default=ShiftSwapStatusEnum.pending)
    approved_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    requester = relationship("Employee", foreign_keys=[requester_id])
    requested_employee = relationship("Employee", foreign_keys=[requested_employee_id])
    requester_shift = relationship("Shift", foreign_keys=[requester_shift_id])
    requested_shift = relationship("Shift", foreign_keys=[requested_shift_id])
    approver = relationship("Employee", foreign_keys=[approved_by])


class PolicyCategoryEnum(str, enum.Enum):
    policy = "policy"
    handbook = "handbook"
    sop = "sop"
    hr_manual = "hr_manual"
    other = "other"


class Policy(Base):
    __tablename__ = "policies"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(SAEnum(PolicyCategoryEnum), default=PolicyCategoryEnum.policy)
    audience = Column(String(20), default="all")   # "all" | "specific"
    file_path = Column(String(500))
    file_name = Column(String(200))
    file_size = Column(Integer)
    uploaded_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    uploader = relationship("Employee", foreign_keys=[uploaded_by])
    assignments = relationship("PolicyAssignment", back_populates="policy", cascade="all, delete-orphan")


class PolicyAssignment(Base):
    __tablename__ = "policy_assignments"
    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    policy = relationship("Policy", back_populates="assignments")
    employee = relationship("Employee", foreign_keys=[employee_id])
    assigner = relationship("Employee", foreign_keys=[assigned_by])


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(Integer, ForeignKey("employees.id"), unique=True, nullable=True)
    employee_id = Column(String(50))
    full_name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    # Refreshed (throttled) on any authenticated request — distinct from
    # last_login, which only moves when a fresh token is issued and can sit
    # stale for up to a full 24h token lifetime while someone is actively
    # working. See get_current_user() in app/core/security.py.
    last_active = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", foreign_keys=[emp_id])


class UserRole(Base):
    """Single source of truth for system_role (RBAC access control).
    employee_id is the PK; absence of a row means system_role='Employee'.
    Neither `employees` nor `users` carries a role column — this is the
    only place it lives. Always resolve access via get_effective_role().
    """
    __tablename__ = "user_roles"
    employee_id  = Column(String(50), primary_key=True)
    email        = Column(String(255), nullable=True)
    system_role  = Column(String(20),  nullable=False, default="Employee")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())


class UserActivityLog(Base):
    """Audit trail for the User Management page (role/manager/login-access/
    archive/invite/reset-password changes). Nothing else in this schema
    tracked who-did-what before this — purely additive table."""
    __tablename__ = "user_activity_log"
    id          = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)  # subject
    actor_id    = Column(Integer, ForeignKey("employees.id"), nullable=True)   # who performed it
    action      = Column(String(50), nullable=False)
    detail      = Column(String(255), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    """The bell dropdown's backing table. Originally created by the Associate
    Engagement module (raw-SQL migration, psycopg2) for timesheet/expense
    events; this mapping lets core HRMS routes (leave, announcements, ...)
    write to the same table/bell via the ORM instead of duplicating it."""
    __tablename__ = "notifications"
    id         = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id    = Column(Integer, ForeignKey("employees.id"), nullable=False)
    type       = Column(String(50), nullable=False)
    title      = Column(String(255), nullable=False)
    body       = Column(Text, nullable=True)
    link       = Column(String(255), nullable=True)
    read_at    = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Employee Self-Service Modules ─────────────────────────────────────────────


class TravelRequestStatusEnum(str, enum.Enum):
    pending   = "pending"
    approved  = "approved"
    rejected  = "rejected"
    cancelled = "cancelled"


class TravelRequest(Base):
    __tablename__ = "travel_requests"
    id                     = Column(Integer, primary_key=True, index=True)
    employee_id            = Column(Integer, ForeignKey("employees.id"), nullable=False)
    destination            = Column(String(200), nullable=False)
    purpose                = Column(Text, nullable=False)
    departure_date         = Column(Date, nullable=False)
    return_date            = Column(Date, nullable=False)
    travel_mode            = Column(String(50))
    accommodation_required = Column(Boolean, default=False)
    estimated_budget       = Column(Float, default=0)
    status                 = Column(SAEnum(TravelRequestStatusEnum), default=TravelRequestStatusEnum.pending)
    approved_by            = Column(Integer, ForeignKey("employees.id"), nullable=True)
    approved_at            = Column(DateTime(timezone=True))
    rejection_reason       = Column(Text)
    notes                  = Column(Text)
    created_by             = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_by             = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())
    updated_at             = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
    approver = relationship("Employee", foreign_keys=[approved_by])


class ReimbursementStatusEnum(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"
    paid     = "paid"


class ReimbursementRequest(Base):
    __tablename__ = "reimbursement_requests"
    id               = Column(Integer, primary_key=True, index=True)
    employee_id      = Column(Integer, ForeignKey("employees.id"), nullable=False)
    category         = Column(String(100), nullable=False)
    description      = Column(Text, nullable=False)
    amount           = Column(Float, nullable=False)
    expense_date     = Column(Date, nullable=False)
    status           = Column(SAEnum(ReimbursementStatusEnum), default=ReimbursementStatusEnum.pending)
    approved_by      = Column(Integer, ForeignKey("employees.id"), nullable=True)
    approved_at      = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    payment_date     = Column(Date)
    created_by       = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_by       = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    employee  = relationship("Employee", foreign_keys=[employee_id])
    approver  = relationship("Employee", foreign_keys=[approved_by])
    documents = relationship("ReimbursementDocument", back_populates="reimbursement", cascade="all, delete-orphan")


class ReimbursementDocument(Base):
    __tablename__ = "reimbursement_documents"
    id                 = Column(Integer, primary_key=True, index=True)
    reimbursement_id   = Column(Integer, ForeignKey("reimbursement_requests.id"), nullable=False)
    file_path          = Column(String(500))
    file_name          = Column(String(200))
    file_size          = Column(Integer)
    uploaded_by        = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    reimbursement = relationship("ReimbursementRequest", back_populates="documents")


class OffboardingRequest(Base):
    __tablename__ = "offboarding_requests"
    id                  = Column(Integer, primary_key=True, index=True)
    employee_id         = Column(Integer, ForeignKey("employees.id"), nullable=False, unique=True)
    resignation_date    = Column(Date, nullable=False)
    last_working_day    = Column(Date)
    reason              = Column(Text)
    status              = Column(String(20), default="submitted")
    hr_comments         = Column(Text)
    exit_interview_date = Column(DateTime(timezone=True))
    clearance_status    = Column(String(20), default="pending")
    created_by          = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_by          = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    employee        = relationship("Employee", foreign_keys=[employee_id])
    checklist_items = relationship("OffboardingChecklist", back_populates="offboarding", cascade="all, delete-orphan")


class OffboardingChecklist(Base):
    __tablename__ = "offboarding_checklists"
    id             = Column(Integer, primary_key=True, index=True)
    offboarding_id = Column(Integer, ForeignKey("offboarding_requests.id"), nullable=False)
    item           = Column(String(200), nullable=False)
    is_completed   = Column(Boolean, default=False)
    completed_by   = Column(Integer, ForeignKey("employees.id"), nullable=True)
    completed_at   = Column(DateTime(timezone=True))

    offboarding = relationship("OffboardingRequest", back_populates="checklist_items")


class InsuranceDependentRelationEnum(str, enum.Enum):
    spouse  = "spouse"
    child   = "child"
    parent  = "parent"
    sibling = "sibling"


class InsuranceDetail(Base):
    __tablename__ = "insurance_details"
    id              = Column(Integer, primary_key=True, index=True)
    employee_id     = Column(Integer, ForeignKey("employees.id"), nullable=False, unique=True)
    policy_number   = Column(String(100))
    provider        = Column(String(200))
    plan_name       = Column(String(200))
    coverage_amount = Column(Float, default=0)
    start_date      = Column(Date)
    end_date        = Column(Date)
    is_active       = Column(Boolean, default=True)
    document_path   = Column(String(500))
    created_by      = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_by      = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    employee   = relationship("Employee", foreign_keys=[employee_id])
    dependents = relationship("InsuranceDependent", back_populates="insurance", cascade="all, delete-orphan")


class InsuranceDependent(Base):
    __tablename__ = "insurance_dependents"
    id           = Column(Integer, primary_key=True, index=True)
    insurance_id = Column(Integer, ForeignKey("insurance_details.id"), nullable=False)
    name         = Column(String(200), nullable=False)
    relation     = Column(SAEnum(InsuranceDependentRelationEnum), nullable=False)
    date_of_birth = Column(Date)
    status       = Column(String(20), default="active")
    created_by   = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_by   = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    insurance = relationship("InsuranceDetail", back_populates="dependents")


class AssetRequisitionStatusEnum(str, enum.Enum):
    pending   = "pending"
    approved  = "approved"
    rejected  = "rejected"
    fulfilled = "fulfilled"
    cancelled = "cancelled"


class AssetRequisition(Base):
    __tablename__ = "asset_requisitions"
    id               = Column(Integer, primary_key=True, index=True)
    employee_id      = Column(Integer, ForeignKey("employees.id"), nullable=False)
    asset_type       = Column(String(100), nullable=False)
    quantity         = Column(Integer, default=1)
    purpose          = Column(Text, nullable=False)
    priority         = Column(String(20), default="normal")
    required_by      = Column(Date)
    status           = Column(SAEnum(AssetRequisitionStatusEnum), default=AssetRequisitionStatusEnum.pending)
    approved_by      = Column(Integer, ForeignKey("employees.id"), nullable=True)
    approved_at      = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    fulfilled_at     = Column(DateTime(timezone=True))
    notes            = Column(Text)
    created_by       = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_by       = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
    approver = relationship("Employee", foreign_keys=[approved_by])


# ── Leave Tracker ─────────────────────────────────────────────────────────────

class Holiday(Base):
    __tablename__ = "holidays"
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(200), nullable=False)
    date         = Column(Date, nullable=False)
    # Matches Employee.country exactly ('India' | 'United States' | 'Canada') so an
    # employee's holiday list is a plain equality match against their own record —
    # each office has its own calendar, so the same date can be a holiday in one
    # region and a normal working day in another (composite-unique below, not a
    # bare unique on date).
    region       = Column(String(50), nullable=False, default="India")
    holiday_type = Column(String(50), default="public")  # public | optional | restricted
    description  = Column(Text)
    year         = Column(Integer, nullable=False, index=True)
    created_by   = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("Employee", foreign_keys=[created_by])

    __table_args__ = (UniqueConstraint("date", "region", name="uq_holidays_date_region"),)


# ── Asset Ticket System ───────────────────────────────────────────────────────


class ARTicketStatusEnum(str, enum.Enum):
    open        = "open"
    in_progress = "in_progress"
    pending     = "pending"
    resolved    = "resolved"
    closed      = "closed"
    cancelled   = "cancelled"


class AssetTicket(Base):
    __tablename__ = "asset_tickets"
    id             = Column(Integer, primary_key=True, index=True)
    ticket_number  = Column(String(20), unique=True, index=True)
    employee_id    = Column(Integer, ForeignKey("employees.id"), nullable=False)
    department_id  = Column(Integer, ForeignKey("departments.id"), nullable=True)
    service_type   = Column(String(200))
    classification = Column(String(200))
    subject        = Column(String(500), nullable=False)
    description    = Column(Text, nullable=False)
    priority       = Column(String(20), default="medium")
    status         = Column(SAEnum(ARTicketStatusEnum, name="ar_ticket_status_enum"),
                            default=ARTicketStatusEnum.open)
    cc_emails      = Column(Text)                                         # JSON array string
    created_by     = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_by     = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    employee       = relationship("Employee", foreign_keys=[employee_id])
    department     = relationship("Department", foreign_keys=[department_id])
    attachments    = relationship("ARAttachment",    back_populates="ticket", cascade="all, delete-orphan")
    status_history = relationship("ARStatusHistory", back_populates="ticket", cascade="all, delete-orphan",
                                  order_by="ARStatusHistory.changed_at")


class ARAttachment(Base):
    __tablename__ = "ar_attachments"
    id          = Column(Integer, primary_key=True, index=True)
    ticket_id   = Column(Integer, ForeignKey("asset_tickets.id"), nullable=False)
    file_name   = Column(String(200))
    file_path   = Column(String(500))
    file_size   = Column(Integer)
    mime_type   = Column(String(100))
    uploaded_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("AssetTicket", back_populates="attachments")


class ARStatusHistory(Base):
    __tablename__ = "ar_status_history"
    id         = Column(Integer, primary_key=True, index=True)
    ticket_id  = Column(Integer, ForeignKey("asset_tickets.id"), nullable=False)
    old_status = Column(String(50))
    new_status = Column(String(50))
    remarks    = Column(Text)
    changed_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket  = relationship("AssetTicket", back_populates="status_history")
    changer = relationship("Employee", foreign_keys=[changed_by])


# ── Org Chart Editor ──────────────────────────────────────────────────────────

class OrgChartLayout(Base):
    """Canvas placement for the drag-and-drop org chart editor.

    Reporting lines live on Employee.manager_id (the real column); this table
    only stores whether an employee has been dragged onto the canvas and
    where, so the editor can be reset without touching reporting data.
    """
    __tablename__ = "org_chart_layouts"
    employee_id = Column(Integer, ForeignKey("employees.id"), primary_key=True)
    position_x  = Column(Float, nullable=True)
    position_y  = Column(Float, nullable=True)
    in_chart    = Column(Boolean, default=False, nullable=False)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
