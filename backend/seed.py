"""
Seed script to initialize database with sample data for Cotelligent HRMS
Run: python seed.py
"""
import sys
sys.path.append(".")

from app.db.database import SessionLocal, engine
from app.models.base import Base, Employee, Department, LeaveType, LeaveBalance, Announcement, Asset, AssetAssignment, UserRole
from app.core.security import get_password_hash
from datetime import date, datetime

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Departments
    depts = [
        Department(name="Engineering", code="ENG", description="Software Development & Tech"),
        Department(name="Human Resources", code="HR", description="HR & Talent Management"),
        Department(name="Finance", code="FIN", description="Finance & Accounting"),
        Department(name="Sales", code="SAL", description="Sales & Business Development"),
        Department(name="Marketing", code="MKT", description="Marketing & Communications"),
        Department(name="Operations", code="OPS", description="Operations & Admin"),
    ]
    for d in depts:
        existing = db.query(Department).filter(
            (Department.name == d.name) | (Department.code == d.code)
        ).first()
        if not existing:
            db.add(d)
    db.commit()

    eng = db.query(Department).filter(Department.code == "ENG").first()
    hr = db.query(Department).filter(Department.code == "HR").first()

    # Admin user
    admin = db.query(Employee).filter(Employee.email == "admin@techdemocracy.com").first()
    if not admin:
        admin = Employee(
            employee_id="CTL-0001",
            first_name="Admin",
            last_name="User",
            email="admin@techdemocracy.com",
            hashed_password=get_password_hash("Admin@123"),
            title="System Administrator",
            department_id=hr.id,
            date_of_joining=date(2020, 1, 1),
            status="active",
            base_salary=100000,
            gender="Male",
            mobile_phone="9999999999"
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # HR Manager (informational role only; access = Employee in new RBAC)
    hr_mgr = db.query(Employee).filter(Employee.email == "hr@techdemocracy.com").first()
    if not hr_mgr:
        hr_mgr = Employee(
            employee_id="CTL-0002",
            first_name="Priya",
            last_name="Sharma",
            email="hr@techdemocracy.com",
            hashed_password=get_password_hash("Hr@12345"),
            title="HR Manager",
            department_id=hr.id,
            date_of_joining=date(2021, 3, 15),
            status="active",
            base_salary=80000,
            gender="Female",
            mobile_phone="9888777666"
        )
        db.add(hr_mgr)
        db.commit()
        db.refresh(hr_mgr)

    # Sample employees
    sample_employees = [
        ("CTL-0003", "Rahul",  "Verma",  "rahul@techdemocracy.com",  "employee", "Engineering Manager",  eng.id, 90000),
        ("CTL-0004", "Ananya", "Patel",  "ananya@techdemocracy.com", "employee", "Senior Developer",     eng.id, 70000),
        ("CTL-0005", "Vikram", "Singh",  "vikram@techdemocracy.com", "employee", "Full Stack Developer",  eng.id, 65000),
        ("CTL-0006", "Kavya",  "Reddy",  "kavya@techdemocracy.com",  "employee", "UI/UX Designer",       eng.id, 60000),
    ]
    for emp_id, fn, ln, email, role, job_title, dept_id, salary in sample_employees:
        existing = db.query(Employee).filter(Employee.email == email).first()
        if not existing:
            e = Employee(
                employee_id=emp_id,
                first_name=fn,
                last_name=ln,
                email=email,
                hashed_password=get_password_hash("Welcome@123"),
                title=job_title,
                department_id=dept_id,
                date_of_joining=date(2022, 6, 1),
                status="active",
                base_salary=salary,
                mobile_phone="9876543210"
            )
            db.add(e)
    db.commit()

    # Additional named users – dev seed only.
    # The role column below is informational only (used for rbac_admins below);
    # effective RBAC access is controlled entirely by the user_roles table (seeded below).
    named_users = [
        # employee_id, first, last, email, emp_role, title, dept_id, salary, gender
        ("CTL-0007", "Sridhar",   "Iriventi",    "sridhar.iriventi@techdemocracy.com",  "admin",    "Senior Administrator", hr.id,  95000, "Male"),
        ("CTL-0008", "Sai",       "Yalamanchili","sai.yalamanchili@techdemocracy.com",  "admin",    "HR Administrator",     hr.id,  90000, "Male"),
        ("CTL-0009", "Lakshmi",   "Narayana",    "lakshmi.narayana@techdemocracy.com",  "admin",    "Admin Manager",        hr.id,  92000, "Female"),
        ("CTL-0010", "Mrutunjay", "Shinde",      "mrutunjay.shinde@techdemocracy.com",  "employee", "Software Engineer",    eng.id, 68000, "Male"),
        ("CTL-0011", "Ramu",      "Vundavelli",  "ramu.vundavelli@techdemocracy.com",   "employee", "Software Developer",   eng.id, 65000, "Male"),
    ]
    for emp_id, fn, ln, email, role, job_title, dept_id, salary, gender in named_users:
        existing = db.query(Employee).filter(Employee.email == email).first()
        if not existing:
            e = Employee(
                employee_id=emp_id,
                first_name=fn,
                last_name=ln,
                email=email,
                hashed_password=get_password_hash("Welcome@123"),
                title=job_title,
                department_id=dept_id,
                date_of_joining=date(2024, 1, 15),
                status="active",
                base_salary=salary,
                gender=gender,
                mobile_phone="9000000000"
            )
            db.add(e)
    db.commit()

    # Leave Types — active types shown in dropdown
    leave_types = [
        # name,               code,       days, carry, paid,  is_active
        ("Sick Leave",        "SL",         10, False, True,  True),
        ("Earned Leaves",     "EL",         21, True,  True,  True),
        ("Loss-of-Pay",       "LOP",         0, False, False, True),
        ("Compensatory Off",  "CO",          0, False, True,  True),
        ("Business Travel",   "BT",          0, False, True,  True),
        ("Leave Bucket",      "LB",          0, False, True,  True),
        ("WFH_Emp Quota",     "WFH_EMP",     0, False, True,  True),
        ("WFH_Manager Quota", "WFH_MGR",     0, False, True,  True),
        ("WFC (Work From Client)", "WFC",    0, False, True,  True),
        # Preserved for referential integrity with historical leave_requests
        ("Casual Leave",      "CL",         12, False, True,  False),
        ("Maternity Leave",   "ML",        182, False, True,  False),
        ("Paternity Leave",   "PatL",       15, False, True,  False),
    ]
    for name, code, days, carry, paid, is_active in leave_types:
        existing = db.query(LeaveType).filter(LeaveType.code == code).first()
        if not existing:
            lt = LeaveType(name=name, code=code, days_allowed=days,
                           carry_forward=carry, paid=paid, is_active=is_active)
            db.add(lt)
    db.commit()

    # Initialize leave balances for all employees
    employees = db.query(Employee).filter(Employee.status == "active").all()
    leave_types_db = db.query(LeaveType).all()
    current_year = datetime.now().year
    for emp in employees:
        for lt in leave_types_db:
            existing = db.query(LeaveBalance).filter(
                LeaveBalance.employee_id == emp.employee_id,
                LeaveBalance.leave_type_id == lt.id,
                LeaveBalance.year == current_year
            ).first()
            if not existing and lt.days_allowed > 0:
                lb = LeaveBalance(
                    employee_id=emp.employee_id,
                    leave_type_id=lt.id,
                    year=current_year,
                    total_days=lt.days_allowed,
                    used_days=0,
                    remaining_days=lt.days_allowed
                )
                db.add(lb)
    db.commit()

    # Announcements
    ann = db.query(Announcement).first()
    if not ann:
        announcements = [
            ("Welcome to Cotelligent HRMS!", "We are excited to launch our new HR Management System. Please explore all the features and let HR know if you need any assistance.", "general", "high"),
            ("Q1 Performance Reviews", "Q1 2025 performance reviews are now open. Please complete your self-assessment by April 30, 2025.", "hr", "normal"),
            ("Holiday Calendar 2025", "The official holiday calendar for 2025 has been published. Please check the announcements section for details.", "general", "normal"),
        ]
        for title, content, cat, priority in announcements:
            a = Announcement(
                title=title, content=content, category=cat, priority=priority,
                published_by=admin.id, is_active=True
            )
            db.add(a)
        db.commit()

    # ── Assets ──────────────────────────────────────────────────────────────
    if db.query(Asset).count() == 0:
        ananya = db.query(Employee).filter(Employee.email == "ananya@techdemocracy.com").first()
        vikram  = db.query(Employee).filter(Employee.email == "vikram@techdemocracy.com").first()
        kavya   = db.query(Employee).filter(Employee.email == "kavya@techdemocracy.com").first()
        rahul   = db.query(Employee).filter(Employee.email == "rahul@techdemocracy.com").first()
        priya   = db.query(Employee).filter(Employee.email == "hr@techdemocracy.com").first()

        assets_data = [
            # ── Laptops ──────────────────────────────────────────────────
            dict(asset_code="#LT-0001", name="Dell XPS 15", category="laptop",
                 serial_number="DXP15-2024-001", purchase_date=date(2024, 3, 12),
                 purchase_cost=120000, vendor="Dell India", warranty_expiry=date(2027, 3, 12),
                 status="assigned", current_employee_id=ananya.id if ananya else None),
            dict(asset_code="#LT-0002", name="MacBook Pro M3", category="laptop",
                 serial_number="MBP-M3-0038", purchase_date=date(2023, 11, 5),
                 purchase_cost=185000, vendor="Apple India", warranty_expiry=date(2026, 11, 5),
                 status="available", current_employee_id=None),
            dict(asset_code="#LT-0003", name="HP EliteBook 840", category="laptop",
                 serial_number="HPEB-840-003", purchase_date=date(2023, 6, 20),
                 purchase_cost=95000, vendor="HP India", warranty_expiry=date(2026, 6, 20),
                 status="assigned", current_employee_id=rahul.id if rahul else None),
            dict(asset_code="#LT-0004", name="Lenovo ThinkPad X1", category="laptop",
                 serial_number="LNV-X1-004", purchase_date=date(2022, 9, 1),
                 purchase_cost=110000, vendor="Lenovo India", warranty_expiry=date(2025, 9, 1),
                 status="maintenance", current_employee_id=None),
            dict(asset_code="#LT-0005", name="Dell Inspiron 15", category="laptop",
                 serial_number="DIN-15-005", purchase_date=date(2021, 4, 10),
                 purchase_cost=75000, vendor="Dell India", warranty_expiry=date(2024, 4, 10),
                 status="retired", current_employee_id=None),
            # ── Mobile Phones ─────────────────────────────────────────────
            dict(asset_code="#MB-0001", name="iPhone 15 Pro", category="mobile_phone",
                 serial_number="IPH15P-0019", purchase_date=date(2024, 1, 15),
                 purchase_cost=134900, vendor="Apple India", warranty_expiry=date(2025, 1, 15),
                 status="assigned", current_employee_id=vikram.id if vikram else None),
            dict(asset_code="#MB-0002", name="Samsung Galaxy S24", category="mobile_phone",
                 serial_number="SGS24-002", purchase_date=date(2024, 2, 20),
                 purchase_cost=79999, vendor="Samsung India", warranty_expiry=date(2025, 2, 20),
                 status="assigned", current_employee_id=kavya.id if kavya else None),
            dict(asset_code="#MB-0003", name="OnePlus 12", category="mobile_phone",
                 serial_number="OP12-003", purchase_date=date(2023, 8, 10),
                 purchase_cost=64999, vendor="OnePlus India", warranty_expiry=date(2024, 8, 10),
                 status="available", current_employee_id=None),
            # ── Access Cards ──────────────────────────────────────────────
            dict(asset_code="#AC-0001", name="Access Card - Office", category="access_card",
                 serial_number="AC-OFF-0055", purchase_date=date(2023, 1, 1),
                 purchase_cost=500, vendor="HID Global", warranty_expiry=None,
                 status="maintenance", current_employee_id=None,
                 notes="Sent for repair"),
            dict(asset_code="#AC-0002", name="Access Card - Server Room", category="access_card",
                 serial_number="AC-SRV-002", purchase_date=date(2023, 1, 1),
                 purchase_cost=800, vendor="HID Global", warranty_expiry=None,
                 status="assigned", current_employee_id=rahul.id if rahul else None),
            dict(asset_code="#AC-0003", name="Access Card - Office", category="access_card",
                 serial_number="AC-OFF-003", purchase_date=date(2022, 6, 15),
                 purchase_cost=500, vendor="HID Global", warranty_expiry=None,
                 status="assigned", current_employee_id=ananya.id if ananya else None),
            # ── Monitors ──────────────────────────────────────────────────
            dict(asset_code="#MN-0001", name="LG 27\" 4K Monitor", category="monitor",
                 serial_number="LG27-MN-0008", purchase_date=date(2023, 4, 5),
                 purchase_cost=32000, vendor="LG India", warranty_expiry=date(2026, 4, 5),
                 status="assigned", current_employee_id=priya.id if priya else None),
            dict(asset_code="#MN-0002", name="Dell 24\" Monitor", category="monitor",
                 serial_number="DL24-MN-002", purchase_date=date(2022, 7, 10),
                 purchase_cost=18000, vendor="Dell India", warranty_expiry=date(2025, 7, 10),
                 status="available", current_employee_id=None),
            # ── Vehicles ──────────────────────────────────────────────────
            dict(asset_code="#VH-0001", name="Toyota Innova (MH-12-AB-1234)", category="vehicle",
                 serial_number="TIN-MH12-001", purchase_date=date(2022, 3, 20),
                 purchase_cost=1800000, vendor="Toyota India", warranty_expiry=date(2025, 3, 20),
                 status="available", current_employee_id=None),
            dict(asset_code="#VH-0002", name="Maruti Swift (MH-12-CD-5678)", category="vehicle",
                 serial_number="MSW-MH12-002", purchase_date=date(2021, 8, 15),
                 purchase_cost=750000, vendor="Maruti Suzuki", warranty_expiry=date(2024, 8, 15),
                 status="retired", current_employee_id=None),
        ]

        created_assets = {}
        for ad in assets_data:
            a = Asset(**ad)
            db.add(a)
            db.flush()
            created_assets[a.asset_code] = a

        db.commit()

        # ── Lifecycle events ─────────────────────────────────────────────
        lt0001 = created_assets.get("#LT-0001")
        lt0002 = created_assets.get("#LT-0002")
        lt0003 = created_assets.get("#LT-0003")
        mb0001 = created_assets.get("#MB-0001")
        mn0001 = created_assets.get("#MN-0001")
        ac0001 = created_assets.get("#AC-0001")

        lifecycle_events = []

        # Dell XPS 15 (#LT-0001) - full lifecycle matching the screenshot
        if lt0001:
            lifecycle_events += [
                AssetAssignment(asset_id=lt0001.id, event_type="purchased",
                    event_date=date(2024, 3, 12),
                    notes="Purchased & added to inventory", performed_by=admin.id),
                AssetAssignment(asset_id=lt0001.id, employee_id=rahul.id if rahul else None,
                    event_type="assigned", event_date=date(2024, 3, 15),
                    notes="Assigned to Rahul Verma (onboarding) · acknowledgement signed",
                    performed_by=admin.id),
                AssetAssignment(asset_id=lt0001.id, event_type="maintenance_sent",
                    event_date=date(2024, 11, 3),
                    notes="Sent for battery replacement · returned Nov 10",
                    performed_by=admin.id),
                AssetAssignment(asset_id=lt0001.id, event_type="maintenance_returned",
                    event_date=date(2024, 11, 10),
                    notes="Battery replaced, returned to employee",
                    performed_by=admin.id),
                AssetAssignment(asset_id=lt0001.id, employee_id=rahul.id if rahul else None,
                    event_type="returned", event_date=date(2026, 4, 20),
                    notes="Rahul Verma exits — asset returned · condition: good",
                    performed_by=admin.id),
                AssetAssignment(asset_id=lt0001.id, employee_id=ananya.id if ananya else None,
                    event_type="assigned", event_date=date(2026, 5, 2),
                    notes="Reassigned to Ananya Patel · current holder",
                    performed_by=admin.id),
            ]

        # MacBook Pro M3 (#LT-0002) - returned by Kavya
        if lt0002 and kavya:
            lifecycle_events += [
                AssetAssignment(asset_id=lt0002.id, event_type="purchased",
                    event_date=date(2023, 11, 5),
                    notes="Purchased & added to inventory", performed_by=admin.id),
                AssetAssignment(asset_id=lt0002.id, employee_id=kavya.id,
                    event_type="assigned", event_date=date(2023, 11, 10),
                    notes="Assigned to Kavya Reddy", performed_by=admin.id),
                AssetAssignment(asset_id=lt0002.id, employee_id=kavya.id,
                    event_type="returned", event_date=date(2026, 4, 20),
                    notes="Returned on exit · condition: good", performed_by=admin.id),
            ]

        # HP EliteBook (#LT-0003) - assigned to Rahul
        if lt0003 and rahul:
            lifecycle_events += [
                AssetAssignment(asset_id=lt0003.id, event_type="purchased",
                    event_date=date(2023, 6, 20),
                    notes="Purchased & added to inventory", performed_by=admin.id),
                AssetAssignment(asset_id=lt0003.id, employee_id=rahul.id,
                    event_type="assigned", event_date=date(2023, 7, 1),
                    notes="Assigned to Rahul Verma", performed_by=admin.id),
            ]

        # iPhone 15 Pro (#MB-0001) - assigned to Vikram
        if mb0001 and vikram:
            lifecycle_events += [
                AssetAssignment(asset_id=mb0001.id, event_type="purchased",
                    event_date=date(2024, 1, 15),
                    notes="Purchased & added to inventory", performed_by=admin.id),
                AssetAssignment(asset_id=mb0001.id, employee_id=vikram.id,
                    event_type="assigned", event_date=date(2026, 4, 28),
                    notes="Assigned to Vikram Singh", performed_by=admin.id),
            ]

        # LG Monitor (#MN-0001) - assigned to Priya
        if mn0001 and priya:
            lifecycle_events += [
                AssetAssignment(asset_id=mn0001.id, event_type="purchased",
                    event_date=date(2023, 4, 5),
                    notes="Purchased & added to inventory", performed_by=admin.id),
                AssetAssignment(asset_id=mn0001.id, employee_id=priya.id,
                    event_type="assigned", event_date=date(2026, 4, 25),
                    notes="Assigned to Priya Sharma", performed_by=admin.id),
            ]

        # Access Card (#AC-0001) - sent for maintenance
        if ac0001:
            lifecycle_events += [
                AssetAssignment(asset_id=ac0001.id, event_type="purchased",
                    event_date=date(2023, 1, 1),
                    notes="Purchased & added to inventory", performed_by=admin.id),
                AssetAssignment(asset_id=ac0001.id, event_type="maintenance_sent",
                    event_date=date(2026, 4, 18),
                    notes="Sent for repair — chip failure", performed_by=admin.id),
            ]

        for ev in lifecycle_events:
            db.add(ev)
        db.commit()

    # ── RBAC – user_roles seeding ────────────────────────────────────────────
    # Seed Admin/Super Admin entries for dev employees.
    # In production, run rbac_admin_roster_migration.sql for the real employee IDs.
    rbac_admins = [
        ("CTL-0001", "admin@techdemocracy.com",              "Admin"),
        ("CTL-0007", "sridhar.iriventi@techdemocracy.com",   "Admin"),
        ("CTL-0008", "sai.yalamanchili@techdemocracy.com",   "Admin"),
        ("CTL-0009", "lakshmi.narayana@techdemocracy.com",   "Super Admin"),
    ]
    for eid, email, rbac_role in rbac_admins:
        existing_ur = db.query(UserRole).filter(UserRole.employee_id == eid).first()
        if existing_ur:
            existing_ur.system_role = rbac_role
            existing_ur.email = email
        else:
            db.add(UserRole(employee_id=eid, email=email, system_role=rbac_role))
    db.commit()

    db.close()
    print("Database seeded successfully!")
    print("\nLogin Credentials (RBAC roles):")
    print("   Admin:      admin@techdemocracy.com                / Admin@123")
    print("   Employee:   hr@techdemocracy.com                   / Hr@12345   (Employee access)")
    print("   Admin:      sridhar.iriventi@techdemocracy.com     / Welcome@123")
    print("   Admin:      sai.yalamanchili@techdemocracy.com     / Welcome@123")
    print("   Super Admin: lakshmi.narayana@techdemocracy.com    / Welcome@123")
    print("   Employee:   mrutunjay.shinde@techdemocracy.com     / Welcome@123")
    print("   Employee:   ramu.vundavelli@techdemocracy.com      / Welcome@123")

if __name__ == "__main__":
    seed()

