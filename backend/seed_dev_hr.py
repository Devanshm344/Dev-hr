#!/usr/bin/env python3
"""
Mock data seeder for the dev-hr database.

Run from the backend/ directory:
    python seed_dev_hr.py

Login credentials for dev-hr:
    Admin  : admin@devhr.com   / Techdemocracy@123
    Manager: rajesh.kumar@devhr.com / Techdemocracy@123
"""
import sys
import os
import random
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from psycopg2 import sql as pgsql
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

from app.models.base import (
    Base, Employee, Department, Attendance, LeaveType, LeaveBalance,
    LeaveRequest, Payslip, PerformanceReview, Document, Announcement,
    Asset, AssetAssignment, Shift, EmployeeShiftMapping, UserRole,
    StatusEnum,
    AssetCategoryEnum, AssetStatusEnum, AssetEventEnum, ShiftTypeEnum,
)

# Seed-local classification only (not a DB column — system_role lives in user_roles).
_SEED_ROLE_ADMIN, _SEED_ROLE_HR_MGR, _SEED_ROLE_MANAGER, _SEED_ROLE_EMPLOYEE = (
    "admin", "hr_manager", "manager", "employee"
)
from app.services.leave_policy_seed import sync_leave_policy

# ── Config ────────────────────────────────────────────────────────────────────
DB_HOST     = "localhost"
DB_PORT     = 5432
DB_USER     = "postgres"
DB_PASSWORD = "CHANGE_ME_DB_PASSWORD"
DB_NAME     = "dev-hr"
DEV_HR_URL  = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
HASHED_PW = pwd_ctx.hash("Techdemocracy@123")

SEED = 42
random.seed(SEED)

TODAY = date.today()
NOW   = datetime.now(timezone.utc)


# ── Name pools ────────────────────────────────────────────────────────────────
MALE_FIRST = [
    "Aarav","Arjun","Aditya","Akash","Amit","Ankit","Anil","Ashish","Bharat",
    "Chetan","Deepak","Dev","Dinesh","Gaurav","Harish","Himanshu","Hitesh",
    "Kartik","Kunal","Manish","Mayur","Mihir","Mohit","Nakul","Nikhil","Nilesh",
    "Pankaj","Parth","Piyush","Prakash","Pranav","Prashant","Praveen","Rajesh",
    "Rakesh","Ravi","Ritesh","Rohit","Sachin","Sagar","Sandeep","Sanjay",
    "Saurabh","Shubham","Sunil","Suresh","Tarun","Uday","Vaibhav","Vijay",
    "Vikas","Vinay","Vishal","Yash","Abhishek","Alok","Amrit","Balaji",
    "Chandra","Dhruv","Girish","Hemant","Ishaan","Jatin","Karan","Lalit",
]

FEMALE_FIRST = [
    "Aisha","Akanksha","Amrita","Ananya","Anjali","Ankita","Anuja","Anu",
    "Aparna","Archana","Aruna","Avani","Bharati","Deepa","Deepika","Divya",
    "Geeta","Heena","Isha","Jyoti","Kavita","Kiran","Komal","Lakshmi","Lata",
    "Madhuri","Manasi","Meena","Meera","Megha","Nandita","Neelam","Neha",
    "Nisha","Pallavi","Payal","Pooja","Prachi","Priya","Rekha","Renu",
    "Riddhi","Ritu","Rupal","Sapna","Seema","Shivani","Shruti","Sneha",
    "Sonal","Swati","Tejal","Uma","Usha","Varsha","Vidya","Vrinda","Yogita",
    "Bhavna","Chetana","Disha","Ekta","Foram","Gauri","Harsha","Indira",
]

LAST_NAMES = [
    "Agarwal","Bhat","Chaudhary","Desai","Dubey","Garg","Gupta","Jain","Joshi",
    "Kapoor","Khanna","Kumar","Mahajan","Mehta","Mishra","Naidu","Nair","Patel",
    "Patil","Pillai","Rao","Reddy","Saxena","Shah","Sharma","Singh","Sinha",
    "Trivedi","Varma","Verma","Yadav","Thakur","Rathore","Srivastava","Pandey",
    "Tiwari","Banerjee","Chatterjee","Das","Ghosh","Mukherjee","Roy","Biswas",
    "Choudhury","Bose","Dutta","Iyer","Menon","Krishnan","Subramaniam",
]

CITIES_STATES = [
    ("Mumbai","Maharashtra"),("Pune","Maharashtra"),("Bangalore","Karnataka"),
    ("Hyderabad","Telangana"),("Chennai","Tamil Nadu"),("Delhi","Delhi"),
    ("Gurugram","Haryana"),("Noida","Uttar Pradesh"),("Kolkata","West Bengal"),
    ("Ahmedabad","Gujarat"),("Jaipur","Rajasthan"),("Lucknow","Uttar Pradesh"),
]

BLOOD_GROUPS = ["A+","A-","B+","B-","O+","O-","AB+","AB-"]
BANKS = [
    "HDFC Bank","ICICI Bank","SBI","Axis Bank",
    "Kotak Mahindra","Yes Bank","PNB","Bank of Baroda",
]
IFSC_PREFIXES = {
    "HDFC Bank":"HDFC0","ICICI Bank":"ICIC0","SBI":"SBIN0",
    "Axis Bank":"UTIB0","Kotak Mahindra":"KKBK0",
    "Yes Bank":"YESB0","PNB":"PUNB0","Bank of Baroda":"BARB0",
}

SKILLS = {
    "Engineering":          ["Python","Java","React","Node.js","AWS","Docker","Kubernetes","SQL","MongoDB","Go"],
    "Human Resources":      ["Recruitment","Payroll","Employee Relations","Training","Compliance","HRMS","Labor Law"],
    "Finance & Accounts":   ["Tally","SAP","Excel","Financial Modeling","GST","Auditing","IFRS","MIS"],
    "Marketing":            ["SEO","Google Analytics","Social Media","Content Writing","Campaign Management","Branding"],
    "Sales":                ["Salesforce","CRM","Negotiation","B2B Sales","Lead Generation","Presentation","Forecasting"],
    "Operations":           ["Supply Chain","Logistics","Six Sigma","Lean","ERP","Process Improvement","SAP"],
    "Product Management":   ["Agile","Scrum","Jira","Product Roadmap","User Research","Data Analysis","Figma"],
    "Customer Success":     ["Zendesk","Customer Service","CRM","Communication","Onboarding","Upsell"],
    "Legal & Compliance":   ["Contract Law","Corporate Law","Compliance","Due Diligence","GDPR","Litigation"],
    "IT & Infrastructure":  ["Network","Linux","Windows Server","Cloud","Cybersecurity","ITIL","Monitoring"],
    "Research & Development":["Research","Data Science","ML","Python","Statistics","NLP","Computer Vision"],
    "Business Development": ["Business Strategy","Partnership","Market Research","Negotiation","Networking","BD CRM"],
}

TITLES = {
    "Engineering":          ["Software Engineer","Senior Software Engineer","Lead Engineer","Principal Engineer","Engineering Manager","VP Engineering"],
    "Human Resources":      ["HR Executive","HR Manager","Senior HR Manager","HR Business Partner","HR Director","CHRO"],
    "Finance & Accounts":   ["Accounts Executive","Senior Accountant","Finance Manager","Senior Finance Manager","Head of Finance","CFO"],
    "Marketing":            ["Marketing Executive","Content Writer","Digital Marketing Manager","Brand Manager","Marketing Head","CMO"],
    "Sales":                ["Sales Executive","Senior Sales Executive","Sales Manager","Regional Sales Manager","National Sales Head","VP Sales"],
    "Operations":           ["Operations Executive","Operations Analyst","Operations Manager","Senior Operations Manager","Head of Operations","COO"],
    "Product Management":   ["Associate Product Manager","Product Manager","Senior Product Manager","Principal PM","Group PM","VP Product"],
    "Customer Success":     ["CS Executive","Customer Success Manager","Senior CSM","CS Lead","Head of Customer Success","VP Customer Success"],
    "Legal & Compliance":   ["Legal Executive","Legal Analyst","Legal Manager","Senior Legal Manager","Compliance Head","General Counsel"],
    "IT & Infrastructure":  ["IT Support","System Administrator","IT Manager","DevOps Engineer","Senior IT Manager","IT Director"],
    "Research & Development":["Research Analyst","Research Engineer","Senior Research Engineer","R&D Lead","Principal Research Scientist"],
    "Business Development": ["BD Executive","BD Manager","Senior BD Manager","VP Business Development"],
}

LOCATIONS = [
    "Mumbai HQ","Bangalore Office","Hyderabad Office",
    "Pune Office","Delhi NCR Office","Chennai Office","Remote",
]

EMP_TYPES = ["Permanent","Contract","Permanent","Permanent","Permanent"]   # weighted

STRENGTHS_POOL = [
    "Strong analytical and problem-solving skills.",
    "Excellent communication and collaboration.",
    "Deep technical expertise and ownership.",
    "Proactive approach and initiative.",
    "Consistent delivery and reliability.",
    "Great leadership and mentoring ability.",
    "Customer-focused mindset.",
    "Strong attention to detail.",
]
IMPROVEMENTS_POOL = [
    "Should improve documentation practices.",
    "Can enhance cross-team collaboration.",
    "Time management during peak periods needs attention.",
    "Should take more ownership of projects.",
    "Presentation skills can be improved.",
    "Should upskill on emerging technologies.",
]
GOALS_POOL = [
    "Complete advanced certification in domain.",
    "Lead a project end-to-end independently.",
    "Mentor at least one junior team member.",
    "Improve CSAT score by 15%.",
    "Drive 20% efficiency improvement in process.",
    "Complete cross-functional training.",
]

ANN_DATA = [
    ("Q1 2025 All-Hands Meeting", "We will be hosting our Q1 All-Hands on 10 April 2025 at 3 PM IST. All teams must attend. Agenda will be shared via email.", "event", "high"),
    ("New Leave Policy Effective 1 April 2025", "The updated leave policy is now in effect. Key changes include 2 additional PL days and revised carry-forward rules. Please read the HR policy document.", "policy", "high"),
    ("Public Holidays 2025", "The list of public holidays for 2025 has been published. Please refer to the HR portal for details. Plan your leaves accordingly.", "general", "normal"),
    ("Annual Performance Review Cycle Begins", "The Q4 2024 performance review cycle is now open. Managers must submit reviews by 15 April 2025. Employees are encouraged to complete self-assessments by 10 April.", "hr", "high"),
    ("Diwali Celebration 2024", "The company Diwali celebration will be held on 1 November 2024 at the Mumbai HQ cafeteria from 5 PM onwards. All employees and their families are welcome.", "event", "normal"),
    ("Work From Home Policy Update", "Effective 1 June 2025, employees may work from home up to 2 days per week with manager approval. Please review the updated WFH policy for eligibility criteria.", "policy", "normal"),
    ("Employee of the Quarter - Q4 2024", "Congratulations to Priya Sharma (Engineering) and Arjun Mehta (Sales) for being selected as Employees of the Quarter for Q4 2024!", "recognition", "normal"),
    ("New Medical Insurance Coverage", "We are pleased to announce enhanced medical insurance coverage effective January 2025. Coverage limit increased to INR 7.5 lakh per family. Claims process remains unchanged.", "benefits", "high"),
    ("IT Security Reminder", "Please ensure all work laptops have updated antivirus software and OS patches. Do not use personal USB drives on company devices. Contact IT support for assistance.", "it", "normal"),
    ("Referral Bonus Program Extended", "The Employee Referral Bonus Program has been extended. Refer a candidate who joins and you receive INR 25,000 (for senior roles) or INR 15,000 (for other roles).", "hr", "normal"),
    ("Office Renovation - Pune Office", "The Pune office will undergo renovation from 15-30 March 2025. Employees at Pune are requested to work from home during this period.", "facilities", "normal"),
    ("ISO 27001 Certification Achieved", "We are proud to announce that our organization has received ISO 27001:2022 certification for Information Security Management. This reflects our commitment to security excellence.", "company", "high"),
    ("Leadership Development Program 2025", "Nominations are open for the Leadership Development Program 2025. Managers can nominate high-potential team members by 28 February 2025.", "training", "normal"),
    ("Salary Revision - Effective April 2025", "Annual salary revisions have been processed and will be reflected in the April 2025 payslip. Revised offer letters will be shared via email.", "hr", "high"),
    ("Zero Tolerance for Workplace Harassment", "Reminder: Our organization maintains a strict zero-tolerance policy towards any form of workplace harassment. Report concerns to HR confidentially.", "policy", "high"),
]

ASSET_NAMES = {
    "laptop":       ["Dell Latitude 5540","HP EliteBook 840 G10","Lenovo ThinkPad X1 Carbon","MacBook Pro M3","Asus ProArt Studiobook"],
    "monitor":      ["Dell UltraSharp 27\"","LG 27UK850","Samsung 32\" 4K","HP Z27","BenQ PD2700U"],
    "mobile_phone": ["iPhone 14 Pro","Samsung Galaxy S23","OnePlus 11","Pixel 7 Pro","iPhone 13"],
    "access_card":  ["HID Proximity Card","Suprema BioEntry","ZKTeco Access Card","Identix RFID Card"],
}
VENDORS = {
    "laptop":       ["Dell India","HP India","Lenovo India","Apple India","Asus India"],
    "monitor":      ["Dell India","LG Electronics","Samsung India","HP India","BenQ India"],
    "mobile_phone": ["Apple India","Samsung India","OnePlus India","Google India"],
    "access_card":  ["HID Global","Suprema","ZKTeco India","Identix"],
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def rdate(start: date, end: date) -> date:
    d = (end - start).days
    return start + timedelta(days=random.randint(0, max(d, 0)))

def rand_mobile() -> str:
    return "9" + "".join(random.choices("0123456789", k=9))

def rand_pan() -> str:
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return (
        "".join(random.choices(letters, k=5))
        + "".join(random.choices("0123456789", k=4))
        + random.choice(letters)
    )

def rand_aadhar() -> str:
    return "".join(random.choices("0123456789", k=12))

def rand_account() -> str:
    return "".join(random.choices("0123456789", k=random.randint(10, 16)))

def rand_ifsc(bank: str) -> str:
    prefix = IFSC_PREFIXES.get(bank, "HDFC0")
    return prefix + "".join(random.choices("0123456789", k=6))

def rand_pin() -> str:
    return "".join(random.choices("0123456789", k=6))

def salary_for(dept: str, level_idx: int) -> float:
    """Level 0 = entry, 5 = head."""
    ranges = {
        "Engineering":           (700000, 2800000),
        "Human Resources":       (450000, 1400000),
        "Finance & Accounts":    (550000, 2000000),
        "Marketing":             (500000, 1600000),
        "Sales":                 (450000, 2000000),
        "Operations":            (400000, 1200000),
        "Product Management":    (750000, 2500000),
        "Customer Success":      (450000, 1100000),
        "Legal & Compliance":    (650000, 2200000),
        "IT & Infrastructure":   (550000, 1800000),
        "Research & Development":(800000, 2500000),
        "Business Development":  (650000, 2200000),
    }
    lo, hi = ranges.get(dept, (400000, 1200000))
    factor = min(level_idx / 5.0, 1.0)
    base = lo + (hi - lo) * factor + random.uniform(-30000, 30000)
    return round(max(base, lo), -3)

def payslip_components(annual_salary: float, present_days: int, working_days: int):
    monthly = annual_salary / 12.0
    factor  = present_days / working_days if working_days else 1.0
    earned  = monthly * factor

    basic     = round(earned * 0.40, 2)
    hra       = round(earned * 0.20, 2)
    special   = round(earned * 0.25, 2)
    transport = round(earned * 0.05, 2)
    medical   = round(earned * 0.10, 2)
    gross     = round(basic + hra + special + transport + medical, 2)

    pf    = round(basic * 0.12, 2)
    pt    = 200.0 if gross > 15000 else 0.0
    tds   = round(gross * 0.05, 2) if gross > 41667 else 0.0
    total_ded = round(pf + pt + tds, 2)
    net   = round(gross - total_ded, 2)
    lop   = working_days - present_days

    return dict(
        basic_salary=basic, hra=hra, special_allowance=special,
        transport_allowance=transport, medical_allowance=medical,
        gross_salary=gross, pf_deduction=pf, professional_tax=pt,
        tds=tds, other_deductions=0.0, total_deductions=total_ded,
        net_salary=net, working_days=working_days,
        present_days=present_days, lop_days=float(lop),
    )

def working_days_in_month(yr: int, mo: int) -> int:
    import calendar
    _, days_in_month = calendar.monthrange(yr, mo)
    count = 0
    for d in range(1, days_in_month + 1):
        if date(yr, mo, d).weekday() < 5:
            count += 1
    return count

def is_workday(d: date) -> bool:
    return d.weekday() < 5


# ── Step 1 – create dev-hr database ──────────────────────────────────────────
def create_database():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER,
        password=DB_PASSWORD, database="postgres",
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
    if cur.fetchone():
        print(f"  Database '{DB_NAME}' already exists — skipping creation.")
    else:
        cur.execute(pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(DB_NAME)))
        print(f"  Created database '{DB_NAME}'.")
    cur.close()
    conn.close()


# ── Step 2 – create tables ────────────────────────────────────────────────────
def create_tables(engine):
    Base.metadata.create_all(bind=engine)
    print("  Tables created / verified.")


# ── Step 3 – seed data ────────────────────────────────────────────────────────
DEPT_SPECS = [
    # (name, code, description, count)
    ("Engineering",           "ENG", "Software development and engineering",          50),
    ("Human Resources",       "HR",  "People operations and HR management",           15),
    ("Finance & Accounts",    "FIN", "Financial planning and accounts management",    18),
    ("Marketing",             "MKT", "Brand, digital and content marketing",          20),
    ("Sales",                 "SAL", "B2B sales and revenue generation",              25),
    ("Operations",            "OPS", "Business operations and process management",    18),
    ("Product Management",    "PRD", "Product strategy and roadmap",                  15),
    ("Customer Success",      "CUS", "Customer onboarding and retention",             15),
    ("Legal & Compliance",    "LEG", "Legal affairs and regulatory compliance",        8),
    ("IT & Infrastructure",   "ITC", "IT support and infrastructure management",       8),
    ("Research & Development","RND", "Innovation and applied research",                5),
    ("Business Development",  "BDV", "Partnerships and business expansion",            3),
]
# Total employees: sum of counts = 200


def seed_all(session):
    # ── Departments (no head yet) ────────────────────────────────────────────
    print("  Seeding departments...")
    depts = []
    for name, code, desc, _ in DEPT_SPECS:
        d = Department(name=name, code=code, description=desc)
        session.add(d)
        depts.append(d)
    session.commit()

    dept_map = {d.name: d for d in session.query(Department).all()}

    # ── Employees ────────────────────────────────────────────────────────────
    print("  Seeding employees...")
    used_emails: set = set()
    used_emp_ids: set = set()
    employees_by_dept: dict = {name: [] for name, *_ in DEPT_SPECS}

    emp_counter = 1

    def make_emp_id():
        nonlocal emp_counter
        eid = f"DVH{emp_counter:04d}"
        emp_counter += 1
        return eid

    def unique_email(first: str, last: str, domain: str = "devhr.com") -> str:
        base = f"{first.lower()}.{last.lower()}"
        email = f"{base}@{domain}"
        suffix = 1
        while email in used_emails:
            email = f"{base}{suffix}@{domain}"
            suffix += 1
        used_emails.add(email)
        return email

    all_employees = []
    leadership_emp_ids = set()   # employee_id values that should get monitors/assets as dept leads
    admin_emp_ids = []           # employee_id values that get a user_roles 'Admin' entry
    global_emp_index = 0

    for dept_name, _, _, count in DEPT_SPECS:
        dept = dept_map[dept_name]
        dept_titles = TITLES[dept_name]
        dept_skills = SKILLS[dept_name]
        salary_range_count = len(dept_titles)

        for i in range(count):
            gender = "Female" if random.random() < 0.38 else "Male"
            first = random.choice(FEMALE_FIRST if gender == "Female" else MALE_FIRST)
            last  = random.choice(LAST_NAMES)

            level_idx = 0 if i == 0 else min(i, salary_range_count - 1)
            title_idx = min(i, len(dept_titles) - 1)
            title     = dept_titles[title_idx]

            is_dept_head = (i == 0)
            is_admin     = (dept_name == "Human Resources" and i == 0)
            is_hr_mgr    = (dept_name == "Human Resources" and i in (1, 2))
            is_manager   = is_dept_head and not is_admin and not is_hr_mgr

            role = (
                _SEED_ROLE_ADMIN    if is_admin   else
                _SEED_ROLE_HR_MGR   if is_hr_mgr  else
                _SEED_ROLE_MANAGER  if is_manager else
                _SEED_ROLE_EMPLOYEE
            )

            doj   = rdate(date(2018, 1, 1), date(2024, 12, 31))
            dob   = rdate(date(1975, 1, 1), date(2000, 12, 31))
            city, state = random.choice(CITIES_STATES)
            bank  = random.choice(BANKS)

            primary_skills   = ", ".join(random.sample(dept_skills, min(3, len(dept_skills))))
            secondary_skills = ", ".join(random.sample(dept_skills, min(2, len(dept_skills))))

            email = unique_email(first, last)
            emp_id = make_emp_id()
            base_sal = salary_for(dept_name, level_idx)

            if role != _SEED_ROLE_EMPLOYEE:
                leadership_emp_ids.add(emp_id)
            if is_admin:
                admin_emp_ids.append((emp_id, email))

            emp = Employee(
                employee_id        = emp_id,
                first_name         = first,
                last_name          = last,
                email              = email,
                mobile_phone       = rand_mobile(),
                personal_email     = unique_email(first, last, "gmail.com"),
                work_phone         = rand_mobile(),
                extension          = str(random.randint(100, 999)),
                hashed_password    = HASHED_PW,
                job_role           = "Team member" if role == _SEED_ROLE_EMPLOYEE else "Manager",
                title              = title,
                employment_type    = random.choice(EMP_TYPES),
                status             = StatusEnum.active,
                onboarding_status  = "completed",
                department_id      = dept.id,
                sub_department     = None,
                manager_id         = None,
                reporting_manager_name = None,
                job_level          = f"L{level_idx + 1}",
                work_location      = random.choice(LOCATIONS),
                date_of_joining    = doj,
                date_of_birth      = dob,
                gender             = gender,
                blood_group        = random.choice(BLOOD_GROUPS),
                marital_status     = random.choice(["Single","Married","Married","Married"]),
                father_name        = f"{random.choice(MALE_FIRST)} {last}",
                about_me           = f"Experienced {title} with a passion for excellence and innovation.",
                source_of_hire     = random.choice(["LinkedIn","Referral","Job Portal","Campus","Agency"]),
                present_address    = f"{random.randint(1,200)}, {random.choice(['MG Road','Linking Road','Jubilee Hills','Koregaon Park','Anna Salai'])}, {city}",
                permanent_address  = f"{random.randint(1,200)}, Sector {random.randint(1,50)}, {city}",
                city               = city,
                state              = state,
                country            = "India",
                pincode            = rand_pin(),
                emergency_contact_primary_name   = f"{random.choice(MALE_FIRST)} {last}",
                emergency_contact_primary_number = rand_mobile(),
                emergency_contact_secondary_name = f"{random.choice(FEMALE_FIRST)} {last}",
                emergency_contact_secondary_number = rand_mobile(),
                primary_skill_set  = primary_skills,
                secondary_skill_set= secondary_skills,
                other_skills       = "MS Office, Slack, Zoom",
                total_experience   = f"{random.randint(1, 18)} years",
                current_project    = f"Project {random.choice(['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Omega'])}",
                pan_number         = rand_pan(),
                aadhar_number      = rand_aadhar(),
                bank_account_number= rand_account(),
                bank_name          = bank,
                ifsc_code          = rand_ifsc(bank),
                bank_account_holder_name = f"{first} {last}",
                base_salary        = base_sal,
            )
            session.add(emp)
            all_employees.append(emp)
            employees_by_dept[dept_name].append(emp)
            global_emp_index += 1

    session.commit()
    print(f"  Created {len(all_employees)} employees.")

    for emp_id, email in admin_emp_ids:
        session.add(UserRole(employee_id=emp_id, email=email, system_role="Admin"))
    session.commit()
    print(f"  Assigned Admin system_role to {len(admin_emp_ids)} employee(s) via user_roles.")

    # ── Set department heads and manager relationships ───────────────────────
    print("  Linking department heads and managers...")
    for dept_name, _, _, _ in DEPT_SPECS:
        dept = dept_map[dept_name]
        dept_emps = employees_by_dept[dept_name]
        head = dept_emps[0]
        dept.head_id = head.id

        # Link all non-head employees in this dept to the head as manager
        for emp in dept_emps[1:]:
            emp.manager_id = head.id
            emp.reporting_manager_name = f"{head.first_name} {head.last_name}"

    session.commit()

    # ── Leave policy (target policy set — see leave engine audit) ──────────────
    # Idempotent: safe to call again later against an already-seeded database
    # (e.g. to roll out a policy change) without touching employees/attendance/etc.
    leave_types, balance_map = sync_leave_policy(session)

    # ── Attendance (last 90 weekdays from today) ──────────────────────────────
    print("  Seeding attendance records...")
    workdays = [TODAY - timedelta(days=d) for d in range(90) if is_workday(TODAY - timedelta(days=d))]
    attendance_count = 0
    for emp in all_employees:
        for wday in workdays:
            if random.random() > 0.88:   # ~12% absent
                continue
            # Check-in: 8:30 – 9:45 AM
            ci_h = random.randint(8, 9)
            ci_m = random.randint(0, 45) if ci_h == 9 else random.randint(30, 59)
            check_in_dt = datetime(wday.year, wday.month, wday.day, ci_h, ci_m, tzinfo=timezone.utc)

            # Check-out: 5:30 – 7:30 PM
            co_h = random.randint(17, 19)
            co_m = random.randint(0, 59)
            if co_h == 17:
                co_m = random.randint(30, 59)
            check_out_dt = datetime(wday.year, wday.month, wday.day, co_h, co_m, tzinfo=timezone.utc)

            work_hours = (check_out_dt - check_in_dt).seconds / 3600.0

            att = Attendance(
                employee_id = emp.id,
                date        = wday,
                check_in    = check_in_dt,
                check_out   = check_out_dt,
                work_hours  = round(work_hours, 2),
                status      = "present",
                location    = emp.work_location or "Office",
            )
            session.add(att)
            attendance_count += 1

        if attendance_count % 5000 == 0 and attendance_count > 0:
            session.flush()

    session.commit()
    print(f"  Created {attendance_count} attendance records.")

    # ── Leave requests (last 12 months) ──────────────────────────────────────
    print("  Seeding leave requests...")
    year_ago = TODAY - timedelta(days=365)
    admin_emp = all_employees[employees_by_dept["Human Resources"].index(
        employees_by_dept["Human Resources"][0]
    )]
    # Use dept heads as approvers
    dept_heads = {dept_name: emps[0] for dept_name, emps in employees_by_dept.items()}
    leave_req_count = 0

    for emp in all_employees:
        dept_name = next(
            (dn for dn, emps in employees_by_dept.items() if emp in emps), "Human Resources"
        )
        approver = dept_heads.get(dept_name, all_employees[0])
        num_requests = random.randint(1, 5)

        for _ in range(num_requests):
            lt  = random.choice(leave_types[:3])   # Sick Leave, Earned Leaves, Compensatory Off mainly
            start = rdate(year_ago, TODAY - timedelta(days=2))
            days  = random.randint(1, 3)
            end   = start + timedelta(days=days - 1)
            status = random.choices(
                ["approved","approved","approved","rejected","pending"],
                weights=[50, 20, 15, 10, 5], k=1
            )[0]

            lr = LeaveRequest(
                employee_id   = emp.employee_id,
                leave_type_id = lt.id,
                start_date    = start,
                end_date      = end,
                days          = float(days),
                reason        = random.choice([
                    "Personal work", "Medical appointment", "Family function",
                    "Fever and cold", "Out of station", "Child's school event",
                    "Home repair work", "Travel plan",
                ]),
                status        = status,
                approved_by   = approver.id if status in ("approved","rejected") else None,
                approved_at   = (NOW - timedelta(days=random.randint(1,30))) if status in ("approved","rejected") else None,
                rejection_reason = "Does not meet leave eligibility criteria." if status == "rejected" else None,
            )
            session.add(lr)
            leave_req_count += 1

            # Keep balance in sync with approved current-year leaves
            if status == "approved" and start.year == current_year:
                lb = balance_map.get((emp.employee_id, lt.id))
                if lb and lb.remaining_days >= float(days):
                    lb.used_days      += float(days)
                    lb.remaining_days -= float(days)

    session.commit()
    print(f"  Created {leave_req_count} leave requests.")

    # ── Payslips (last 6 months) ──────────────────────────────────────────────
    print("  Seeding payslips...")
    payslip_count = 0
    for offset in range(6, 0, -1):
        target = TODAY.replace(day=1) - timedelta(days=offset * 28)
        yr, mo = target.year, target.month
        wdays  = working_days_in_month(yr, mo)
        payment_day = date(yr, mo, 28)

        for emp in all_employees:
            present = random.randint(max(wdays - 5, wdays - 3), wdays)
            comps   = payslip_components(emp.base_salary, present, wdays)
            ps = Payslip(
                employee_id = emp.id,
                month       = mo,
                year        = yr,
                status      = "paid" if offset > 1 else random.choice(["paid", "draft"]),
                payment_date= payment_day,
                **comps,
            )
            session.add(ps)
            payslip_count += 1

        session.flush()

    session.commit()
    print(f"  Created {payslip_count} payslips.")

    # ── Performance reviews ───────────────────────────────────────────────────
    print("  Seeding performance reviews...")
    review_count = 0
    review_types = ["Annual", "Mid-Year", "Quarterly", "Probation"]
    review_statuses = ["completed", "completed", "completed", "pending"]

    for emp in all_employees:
        dept_name = next(
            (dn for dn, emps in employees_by_dept.items() if emp in emps), "Human Resources"
        )
        reviewer = employees_by_dept.get(dept_name, [all_employees[0]])[0]
        if reviewer.id == emp.id and len(employees_by_dept.get(dept_name, [])) > 1:
            reviewer = employees_by_dept[dept_name][1]

        num_reviews = random.randint(1, 2)
        for rev_i in range(num_reviews):
            review_year = 2024 if rev_i == 0 else 2025
            rtype       = random.choice(review_types)
            status      = random.choice(review_statuses)

            goals_r    = round(random.uniform(2.5, 5.0), 1)
            skills_r   = round(random.uniform(2.5, 5.0), 1)
            behavior_r = round(random.uniform(2.5, 5.0), 1)
            overall_r  = round((goals_r + skills_r + behavior_r) / 3.0, 1)

            pr = PerformanceReview(
                employee_id      = emp.id,
                reviewer_id      = reviewer.id,
                review_period    = f"Q{random.randint(1,4)} {review_year}",
                review_type      = rtype,
                goals_rating     = goals_r,
                skills_rating    = skills_r,
                behavior_rating  = behavior_r,
                overall_rating   = overall_r,
                strengths        = random.choice(STRENGTHS_POOL),
                improvements     = random.choice(IMPROVEMENTS_POOL),
                goals_next_period= random.choice(GOALS_POOL),
                status           = status,
            )
            session.add(pr)
            review_count += 1

    session.commit()
    print(f"  Created {review_count} performance reviews.")

    # ── Announcements ─────────────────────────────────────────────────────────
    print("  Seeding announcements...")
    hr_head = employees_by_dept["Human Resources"][0]
    for idx, (title, content, category, priority) in enumerate(ANN_DATA):
        created_days_ago = 30 * (len(ANN_DATA) - idx)
        expires = NOW + timedelta(days=180)
        ann = Announcement(
            title        = title,
            content      = content,
            category     = category,
            priority     = priority,
            published_by = hr_head.id,
            is_active    = True,
            expires_at   = expires,
        )
        session.add(ann)
    session.commit()
    print(f"  Created {len(ANN_DATA)} announcements.")

    # ── Assets ────────────────────────────────────────────────────────────────
    print("  Seeding assets...")
    asset_pool = [
        ("laptop",       60),
        ("monitor",      80),
        ("mobile_phone", 30),
        ("access_card",  200),
    ]
    asset_code_counter = 1
    created_assets = []

    for cat_str, count in asset_pool:
        cat = AssetCategoryEnum(cat_str)
        names   = ASSET_NAMES[cat_str]
        vendors = VENDORS[cat_str]
        for _ in range(count):
            name = random.choice(names)
            vendor = random.choice(vendors)
            purchase_d = rdate(date(2021, 1, 1), TODAY - timedelta(days=30))
            warranty_d = purchase_d + timedelta(days=365 * random.randint(1, 3))
            cost = {
                "laptop": random.randint(50000, 120000),
                "monitor": random.randint(15000, 45000),
                "mobile_phone": random.randint(30000, 120000),
                "access_card": random.randint(500, 2000),
            }[cat_str]

            a = Asset(
                asset_code   = f"AST{asset_code_counter:04d}",
                name         = name,
                category     = cat,
                serial_number= f"SN{random.randint(100000,999999)}",
                purchase_date= purchase_d,
                purchase_cost= float(cost),
                vendor       = vendor,
                warranty_expiry = warranty_d,
                status       = AssetStatusEnum.available,
            )
            session.add(a)
            created_assets.append((a, cat_str))
            asset_code_counter += 1

    session.flush()
    print(f"  Created {len(created_assets)} assets.")

    # ── Asset assignments ──────────────────────────────────────────────────────
    it_head = employees_by_dept["IT & Infrastructure"][0]
    assignable_emps = random.sample(all_employees, min(len(all_employees), 180))
    laptop_assets = [a for a, c in created_assets if c == "laptop"]
    monitor_assets = [a for a, c in created_assets if c == "monitor"]
    phone_assets = [a for a, c in created_assets if c == "mobile_phone"]
    card_assets = [a for a, c in created_assets if c == "access_card"]

    def assign_asset(asset, emp, event_date):
        asset.status = AssetStatusEnum.assigned
        asset.current_employee_id = emp.id
        aa = AssetAssignment(
            asset_id    = asset.id,
            employee_id = emp.id,
            event_type  = AssetEventEnum.assigned,
            event_date  = event_date,
            notes       = "Assigned on joining / upgrade",
            performed_by= it_head.id,
        )
        session.add(aa)

    for i, emp in enumerate(assignable_emps):
        assign_date = emp.date_of_joining or TODAY - timedelta(days=30)
        if i < len(laptop_assets):
            assign_asset(laptop_assets[i], emp, assign_date)
        if i < len(card_assets):
            assign_asset(card_assets[i], emp, assign_date)
        if i < len(monitor_assets) and emp.employee_id in leadership_emp_ids:
            idx = min(i, len(monitor_assets) - 1)
            assign_asset(monitor_assets[idx], emp, assign_date)

    session.commit()
    print("  Asset assignments created.")

    # ── Shifts ────────────────────────────────────────────────────────────────
    print("  Seeding shifts and mappings...")
    hr_head_emp = employees_by_dept["Human Resources"][0]
    shifts_data = [
        ("General Shift",  ShiftTypeEnum.general,  "09:30", "18:30", "#6366f1", 15, False),
        ("Morning Shift",  ShiftTypeEnum.morning,  "08:00", "17:00", "#10b981", 10, False),
        ("Evening Shift",  ShiftTypeEnum.evening,  "14:00", "23:00", "#f59e0b", 15, False),
        ("Night Shift",    ShiftTypeEnum.night,    "22:00", "07:00", "#8b5cf6", 20, True),
    ]
    shift_objs = []
    for sname, stype, sstart, send, scolor, grace, is_night in shifts_data:
        s = Shift(
            name                = sname,
            shift_type          = stype,
            start_time          = sstart,
            end_time            = send,
            color               = scolor,
            description         = f"{sname} — {sstart} to {send} IST",
            grace_period_minutes= grace,
            is_night_shift      = is_night,
            created_by          = hr_head_emp.id,
            is_active           = True,
        )
        session.add(s)
        shift_objs.append(s)
    session.flush()

    # Map every employee to a shift
    general_shift = shift_objs[0]
    morning_shift = shift_objs[1]
    evening_shift = shift_objs[2]

    ops_emps = employees_by_dept.get("Operations", [])
    cs_emps  = employees_by_dept.get("Customer Success", [])
    ops_set  = set(e.id for e in ops_emps)
    cs_set   = set(e.id for e in cs_emps)

    for emp in all_employees:
        if emp.id in ops_set:
            shift = morning_shift
        elif emp.id in cs_set:
            shift = evening_shift
        else:
            shift = general_shift

        mapping = EmployeeShiftMapping(
            employee_id  = emp.id,
            shift_id     = shift.id,
            effective_from = emp.date_of_joining or date(2024, 1, 1),
            effective_to   = None,
            assigned_by  = hr_head_emp.id,
            is_active    = True,
        )
        session.add(mapping)

    session.commit()
    print(f"  Created {len(shift_objs)} shifts and {len(all_employees)} shift mappings.")

    print("\n  [OK] All data seeded successfully.")
    print(f"\n  -- Login Credentials for dev-hr --")
    hr_head = employees_by_dept["Human Resources"][0]
    print(f"  Admin     : {hr_head.email} / Techdemocracy@123")
    eng_mgr = employees_by_dept["Engineering"][0]
    print(f"  Manager   : {eng_mgr.email} / Techdemocracy@123")
    sample_emp = employees_by_dept["Engineering"][5]
    print(f"  Employee  : {sample_emp.email} / Techdemocracy@123")
    print(f"  ----------------------------------")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n[seed_dev_hr] Starting seeder...")

    print("\n[1/3] Creating database...")
    create_database()

    print("\n[2/3] Creating tables...")
    dev_engine = create_engine(DEV_HR_URL, pool_pre_ping=True)
    create_tables(dev_engine)

    print("\n[3/3] Seeding data...")
    Session = sessionmaker(bind=dev_engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        # Check if already seeded
        existing = session.query(Employee).count()
        if existing > 0:
            print(f"  Database already has {existing} employees. Skipping full reseed.")
            print("  Syncing leave-type policy configuration against the existing data instead...")
            sync_leave_policy(session)
        else:
            seed_all(session)
    except Exception as exc:
        session.rollback()
        print(f"\n[ERROR] Seeding failed: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()

    print("\n[seed_dev_hr] Done.\n")
