"""Run migrations and seed development data.

Usage: python seed.py

Identity lives in dev-hr's own `employees` table — this script never creates
or passwords any local user. It only seeds this app's own PSA tables
(clients/projects/tasks/timesheets/allocations/expenses) and layers a little
sample history onto a couple of real Engineering employees so the app has
something to look at on first sign-in.
"""
from datetime import date, timedelta
from pathlib import Path

import psycopg2

from app.engagement.core.config import get_settings

ROOT = Path(__file__).parent


def run():
    conn = psycopg2.connect(get_settings().database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # 1. migrations (idempotent)
    for f in sorted((ROOT / "migrations").glob("0*.sql")):
        print(f"applying {f.name}")
        cur.execute(f.read_text())

    # 2. seed static PSA data (clients/projects/tasks/members/expense categories)
    cur.execute((ROOT / "migrations" / "seed.sql").read_text())

    # 3. history: 3 past weeks of time for a real Engineering employee
    cur.execute("SELECT id FROM employees WHERE employee_id='DVH0002'")
    emp = cur.fetchone()[0]
    cur.execute("SELECT id FROM projects WHERE project_code='PRJ-002'")
    proj_ext = cur.fetchone()[0]
    cur.execute("SELECT id FROM projects WHERE project_code='PRJ-001'")
    proj_int = cur.fetchone()[0]
    cur.execute("SELECT id FROM tasks WHERE project_id=%s AND name='Backend Development'", (proj_ext,))
    task_dev = cur.fetchone()[0]
    cur.execute("SELECT id FROM tasks WHERE project_id=%s AND name='Meetings'", (proj_int,))
    task_meet = cur.fetchone()[0]

    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    weeks = [
        (this_monday - timedelta(weeks=3), "approved"),
        (this_monday - timedelta(weeks=2), "approved"),
        (this_monday - timedelta(weeks=1), "submitted"),
    ]
    for ws, status in weeks:
        we = ws + timedelta(days=6)
        cur.execute(
            """
            INSERT INTO timesheets (user_id, week_start_date, week_end_date, status, submitted_at)
            VALUES (%s,%s,%s,%s, %s::date + interval '17 hours')
            ON CONFLICT (user_id, week_start_date) DO NOTHING RETURNING id
            """,
            (emp, ws, we, status, we),
        )
        row = cur.fetchone()
        if row is None:
            continue  # already seeded
        ts_id = row[0]
        for d in range(5):  # Mon..Fri
            work_date = ws + timedelta(days=d)
            cur.execute(
                """INSERT INTO time_entries (timesheet_id,user_id,work_date,project_id,task_id,duration_minutes,billable,description)
                   VALUES (%s,%s,%s,%s,%s,%s,true,%s)""",
                (ts_id, emp, work_date, proj_ext, task_dev, 420, "Feature development"),
            )
            cur.execute(
                """INSERT INTO time_entries (timesheet_id,user_id,work_date,project_id,task_id,duration_minutes,billable,description)
                   VALUES (%s,%s,%s,%s,%s,%s,false,%s)""",
                (ts_id, emp, work_date, proj_int, task_meet, 60, "Standup and syncs"),
            )
        cur.execute(
            """UPDATE timesheets ts SET
                 total_minutes=(SELECT sum(duration_minutes) FROM time_entries WHERE timesheet_id=ts.id),
                 billable_minutes=(SELECT sum(duration_minutes) FROM time_entries WHERE timesheet_id=ts.id AND billable)
               WHERE ts.id=%s""",
            (ts_id,),
        )

    # 4. resource allocations: plan two Engineering employees on the external
    # project for the next few weeks
    cur.execute("SELECT id FROM employees WHERE employee_id='DVH0003'")
    other = cur.fetchone()[0]
    for i in range(4):  # this week + next 3
        ws = this_monday + timedelta(weeks=i)
        cur.execute(
            """INSERT INTO allocations (project_id,user_id,week_start_date,allocated_minutes)
               VALUES (%s,%s,%s,%s) ON CONFLICT (project_id,user_id,week_start_date) DO NOTHING""",
            (proj_ext, emp, ws, 2400),
        )
        cur.execute(
            """INSERT INTO allocations (project_id,user_id,week_start_date,allocated_minutes)
               VALUES (%s,%s,%s,%s) ON CONFLICT (project_id,user_id,week_start_date) DO NOTHING""",
            (proj_ext, other, ws, 1920),
        )

    # 5. sample expenses: one submitted (visible in the manager's inbox), one draft
    cur.execute("SELECT id FROM expense_categories WHERE name='Travel'")
    cat_travel = cur.fetchone()[0]
    cur.execute("SELECT id FROM expense_categories WHERE name='Meals'")
    cat_meals = cur.fetchone()[0]

    def seed_expense(project_id, category_id, expense_date, amount, currency, description, billable, submitted):
        cur.execute(
            "SELECT 1 FROM expenses WHERE user_id=%s AND project_id=%s AND category_id=%s AND expense_date=%s",
            (emp, project_id, category_id, expense_date),
        )
        if cur.fetchone():
            return
        status_cols = ", status, submitted_at" if submitted else ""
        status_vals = ", 'submitted', now()" if submitted else ""
        cur.execute(
            f"""INSERT INTO expenses
                (user_id,project_id,category_id,expense_date,amount,currency,description,billable{status_cols})
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s{status_vals})""",
            (emp, project_id, category_id, expense_date, amount, currency, description, billable),
        )

    seed_expense(proj_ext, cat_travel, today - timedelta(days=2), 245.50, "USD", "Client site visit — round-trip flight", True, submitted=True)
    seed_expense(proj_int, cat_meals, today - timedelta(days=1), 850.00, "INR", "Team lunch", False, submitted=False)

    conn.commit()
    cur.close()
    conn.close()
    print("done. Sign in with any dev-hr employee email and password demo@123")
    print("  admin example:   sagar.ghosh@devhr.com")
    print("  manager example: akash.menon@devhr.com")
    print("  employee example: rakesh.subramaniam@devhr.com")


if __name__ == "__main__":
    run()
