"""API smoke tests — run with the server up: python tests/api_smoke.py

This deployment's identity comes from the real dev-hr `employees` table, not
fixtures this app owns, so fixtures here are *discovered* from dev-hr (by
role/department/manager shape) rather than hardcoded emails. Every account
uses the shared dev password set for this integration: demo@123.
"""
import json
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import psycopg2
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from app.engagement.core.config import get_settings

# Merged app: one FastAPI process (dev-hr-main/backend), engagement's routes
# live under /api/engagement, auth is dev-hr's own /api/auth/login — there is
# no /api/engagement/auth/login anymore. See app/engagement/deps.py.
HOST = "http://localhost:8001"
BASE = HOST + "/api/engagement"
DEV_PASSWORD = "demo@123"
PASS_COUNT = 0
FAIL: list[str] = []


def call_raw(method, url, token=None, body=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body, default=str).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def call(method, path, token=None, body=None):
    return call_raw(method, BASE + path, token=token, body=body)


def check(name, cond, extra=""):
    global PASS_COUNT
    if cond:
        PASS_COUNT += 1
        print(f"  ok  {name}")
    else:
        FAIL.append(name)
        print(f" FAIL {name} {extra}")


def login(email, password=DEV_PASSWORD):
    """Log in through dev-hr's own /api/auth/login (the only login in the
    merged app), then fetch the engagement-shaped identity (role resolved to
    admin/manager/employee, not dev-hr's own Admin/Employee/Super Admin) via
    GET /me — exactly what the frontend's EngagementGate does."""
    status, body = call_raw(
        "POST", HOST + "/api/auth/login", body={"email": email, "password": password}
    )
    if status != 200:
        return status, body
    token = body["access_token"]
    me_status, me_body = call("GET", "/me", token=token)
    if me_status != 200:
        return me_status, me_body
    return 200, {"data": {"token": token, "user": me_body["data"]}}


def discover_fixtures():
    """Pick real dev-hr employees to test with, purely by shape (role/dept/
    manager), so this suite never depends on specific seeded names."""
    conn = psycopg2.connect(get_settings().database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT e.email FROM employees e JOIN user_roles ur ON ur.employee_id = e.employee_id
        WHERE ur.system_role IN ('Admin','Super Admin') ORDER BY e.id LIMIT 1
    """)
    admin_email = cur.fetchone()["email"]

    cur.execute("""
        SELECT e.id, e.email FROM employees e
        WHERE (SELECT count(*) FROM employees r WHERE r.manager_id = e.id) > 0
        ORDER BY (SELECT count(*) FROM employees r WHERE r.manager_id = e.id) DESC LIMIT 1
    """)
    mgr = cur.fetchone()
    manager_id, manager_email = mgr["id"], mgr["email"]

    cur.execute("""
        SELECT e.id, e.email FROM employees e
        WHERE e.manager_id = %s AND e.employee_id NOT IN (SELECT employee_id FROM user_roles)
        ORDER BY e.id LIMIT 2
    """, (manager_id,))
    reports = cur.fetchall()
    employee_id, employee_email = reports[0]["id"], reports[0]["email"]
    second_report_id, second_report_email = reports[1]["id"], reports[1]["email"]

    cur.execute("SELECT id FROM employees WHERE email = %s", (manager_email,))
    manager_dept = None
    cur.execute("SELECT department_id FROM employees WHERE id = %s", (manager_id,))
    manager_dept = cur.fetchone()["department_id"]

    cur.execute("""
        SELECT e.id, e.email FROM employees e
        WHERE e.department_id <> %s AND e.employee_id NOT IN (SELECT employee_id FROM user_roles)
        ORDER BY e.id LIMIT 1
    """, (manager_dept,))
    outsider = cur.fetchone()
    outsider_id, outsider_email = outsider["id"], outsider["email"]

    cur.close()
    conn.close()
    return {
        "admin_email": admin_email,
        "manager_id": manager_id, "manager_email": manager_email,
        "employee_id": employee_id, "employee_email": employee_email,
        "second_report_id": second_report_id, "second_report_email": second_report_email,
        "outsider_id": outsider_id, "outsider_email": outsider_email,
    }


def main():
    fx = discover_fixtures()
    print("fixtures:", {k: v for k, v in fx.items() if k.endswith("email")})

    print("== health ==")
    s, b = call_raw("GET", HOST + "/health")
    check("health 200", s == 200 and b["status"] == "healthy")

    print("== auth ==")
    s, b = login(fx["admin_email"])
    check("admin can log in", s == 200 and b["data"]["user"]["role"] == "admin")
    admin = b["data"]["token"]

    s, b = login(fx["manager_email"])
    check("manager can log in and is recognized as manager", s == 200 and b["data"]["user"]["role"] == "manager")
    mgr = b["data"]["token"]

    s, b = login(fx["employee_email"])
    check("employee can log in and is recognized as employee", s == 200 and b["data"]["user"]["role"] == "employee")
    emp = b["data"]["token"]
    emp_user = b["data"]["user"]

    s, _ = login(fx["employee_email"], "wrong-password")
    check("wrong password rejected 401", s == 401)
    s, _ = call("GET", "/time/week")
    check("no token rejected 401", s == 401)

    s, b = login(fx["outsider_email"])
    check("outsider can log in", s == 200)
    outsider = b["data"]["token"]

    print("== week grid ==")
    s, b = call("GET", "/time/week", emp)
    check("grid loads", s == 200 and len(b["data"]["days"]) == 7)
    ts_id = b["data"]["timesheet"]["id"]
    week_start = date.fromisoformat(b["data"]["timesheet"]["week_start_date"])
    check("week is Monday-start", week_start.weekday() == 0)
    check("due date is the Friday of that week (default Mon-start shift)",
          b["data"]["timesheet"]["due_date"] == (week_start + timedelta(days=4)).isoformat())

    s, opts = call("GET", "/portfolio/time-row-options", emp)
    check("time-row options load with both demo projects", s == 200 and len(opts["data"]) == 2)
    internal = next(p for p in opts["data"] if p["project_name"] == "Internal Tasks")
    external = next((p for p in opts["data"] if p["project_name"] == "E-commerce Replatform"), None)
    meetings = next(t for t in internal["tasks"] if t["task_name"] == "Meetings")

    s, b = call("GET", "/time/week", emp)
    monday = b["data"]["days"][0]

    print("== cell editing ==")
    s, b2 = call("PUT", "/time/entries", emp, {
        "timesheet_id": ts_id, "project_id": str(internal["project_id"]),
        "task_id": str(meetings["task_id"]), "work_date": monday, "minutes": 420, "note": "API test"})
    check("save 7:00 cell", s == 200 and not b2["data"]["deleted"])

    s, _ = call("PUT", "/time/entries", emp, {
        "timesheet_id": ts_id, "project_id": str(internal["project_id"]),
        "task_id": str(meetings["task_id"]), "work_date": monday, "minutes": 1200})
    check("over-daily-capacity cell rejected 422", s == 422, f"got {s}")

    s, b3 = call("GET", "/time/week", emp)
    check("day total = 7:00", b3["data"]["day_totals"][monday] == 420)

    if external:
        s, bout_wk = call("GET", "/time/week", outsider)
        outsider_ts = bout_wk["data"]["timesheet"]["id"]
        s, _ = call("PUT", "/time/entries", outsider, {
            "timesheet_id": outsider_ts, "project_id": str(external["project_id"]),
            "task_id": None, "work_date": monday, "minutes": 60})
        check("non-member of the external (dept-scoped) project cannot log to it 403", s == 403)
    else:
        check("outsider fixture found an external project to test against", False, "no external project in options")

    s, _ = call("PUT", "/time/entries", outsider, {
        "timesheet_id": ts_id, "project_id": str(internal["project_id"]),
        "task_id": str(meetings["task_id"]), "work_date": monday, "minutes": 60})
    check("cannot edit someone else's timesheet 403", s == 403)

    print("== submit workflow ==")
    monday_date = date.fromisoformat(monday)
    for i in range(1, 5):
        work_date = (monday_date + timedelta(days=i)).isoformat()
        s, _ = call("PUT", "/time/entries", emp, {
            "timesheet_id": ts_id, "project_id": str(internal["project_id"]),
            "task_id": str(meetings["task_id"]), "work_date": work_date, "minutes": 420})
        check(f"fills working day {i} of 4 remaining", s == 200)

    s, _ = call("POST", f"/timesheets/{ts_id}/submit", emp)
    check("submit succeeds once all 5 working days have hours", s == 200)
    s, _ = call("POST", f"/timesheets/{ts_id}/submit", emp)
    check("double submit rejected 409", s == 409)

    print("== approvals ==")
    s, _ = call("GET", "/approvals/inbox", emp)
    check("employee blocked from inbox 403", s == 403)

    s, b10 = call("GET", "/approvals/inbox", mgr)
    check("manager inbox loads and includes the submitted week", s == 200 and any(i["id"] == ts_id for i in b10["data"]))

    s, _ = call("POST", f"/approvals/{ts_id}/decision", mgr, {"action": "request_changes"})
    check("request_changes without comment rejected 422", s == 422)

    s, b11 = call("POST", f"/approvals/{ts_id}/decision", mgr, {"action": "request_changes", "comment": "Please recheck Tuesday"})
    check("request_changes with comment ok", s == 200 and b11["data"]["status"] == "changes_requested")

    s, _ = call("POST", f"/timesheets/{ts_id}/submit", emp)
    check("employee can resubmit after changes requested", s == 200)

    s, _ = call("POST", f"/approvals/{ts_id}/decision", mgr, {"action": "approve"})
    check("manager approves resubmitted week", s == 200)
    s, _ = call("POST", f"/approvals/{ts_id}/decision", mgr, {"action": "approve"})
    check("cannot decide on an already-approved week 409", s == 409)

    s, b14 = call("GET", "/approvals/team-auditing?granularity=week&count=4", mgr)
    check("manager team auditing includes direct reports", s == 200 and len(b14["data"]) > 0)
    s, _ = call("GET", "/approvals/team-auditing?granularity=week&count=4", emp)
    check("employee blocked from team auditing 403", s == 403)

    print("== portfolio ==")
    s, b6 = call("GET", "/portfolio/overview", emp)
    check("employee sees at least the internal client", s == 200 and len(b6["data"]) >= 1)
    s, b7 = call("GET", "/portfolio/overview", admin)
    check("admin sees all clients", s == 200 and len(b7["data"]) >= 2)

    s, _ = call("GET", "/portfolio/clients", emp)
    check("employee blocked from clients list 403", s == 403)
    s, bclients = call("GET", "/portfolio/clients", mgr)
    check("manager lists all clients", s == 200 and len(bclients["data"]) >= 2)

    s, bnc = call("POST", "/portfolio/clients", mgr, {
        "client_code": "CL-SMK", "name": "Smoke Test Client", "currency": "USD", "status": "active"})
    check("manager creates a client", s == 200 and bnc["data"]["client_code"] == "CL-SMK")
    new_client_id = bnc["data"]["id"]

    s, bnp = call("POST", "/portfolio/projects", mgr, {
        "project_code": "PRJ-SMK", "name": "Smoke Test Project", "client_id": new_client_id,
        "billing_model": "time_and_materials", "currency": "USD", "status": "active"})
    check(
        "manager creates a project with no PM specified and becomes its PM",
        s == 200 and str(bnp["data"]["project_manager_id"]) == str(fx["manager_id"]),
    )
    new_project_id = bnp["data"]["id"]

    s, _ = call("POST", "/portfolio/projects", emp, {
        "project_code": "PRJ-SMK2", "name": "Nope", "client_id": new_client_id})
    check("employee blocked from creating a project 403", s == 403)

    s, bnt = call("POST", f"/portfolio/projects/{new_project_id}/tasks", mgr, {
        "name": "Smoke Task", "priority": "high", "billable": True})
    check("PM creates a task", s == 200 and bnt["data"]["status"] == "todo")

    s, bam = call("POST", f"/portfolio/projects/{new_project_id}/members", mgr, {
        "user_id": str(fx["second_report_id"]), "project_role": "member"})
    check("PM adds a member", s == 200 and bam["data"]["active"] is True)

    s, bpd = call("GET", f"/portfolio/projects/{new_project_id}", mgr)
    check("new member appears on project detail", s == 200 and any(str(m["id"]) == str(fx["second_report_id"]) for m in bpd["data"]["members"]))

    print("== reports ==")
    s, b8 = call("GET", "/reports/time?group_by=project", emp)
    check("time report loads", s == 200 and len(b8["data"]["rows"]) >= 1)
    s, _ = call("GET", "/reports/time?group_by=person", emp)
    check("employee blocked from person grouping 422", s == 422)
    s, b9 = call("GET", "/reports/time?group_by=person", mgr)
    check("manager person grouping ok", s == 200)

    s, bd_emp = call("GET", "/reports/dashboard", emp)
    check("employee dashboard loads and hides person breakdown", s == 200 and bd_emp["data"]["by_person"] is None)
    s, bd_mgr = call("GET", "/reports/dashboard", mgr)
    check("manager dashboard includes person breakdown", s == 200 and bd_mgr["data"]["by_person"] is not None)

    s, bps = call("GET", "/reports/project-summary", emp)
    check("employee project summary loads", s == 200 and bps["data"]["total_projects"] >= 1)

    print("== allocations ==")
    ext_id = str(external["project_id"]) if external else None
    if ext_id:
        s, _ = call("GET", f"/allocations/matrix?project_id={ext_id}&weeks=4", emp)
        check("employee blocked from matrix 403", s == 403)

        s, bmx = call("GET", f"/allocations/matrix?project_id={ext_id}&weeks=4", mgr)
        check("manager matrix loads", s == 200 and len(bmx["data"]["people"]) >= 1)

        s, _ = call("PUT", "/allocations/cell", emp, {
            "project_id": ext_id, "user_id": str(fx["employee_id"]), "week_start_date": monday, "minutes": 2400})
        check("employee blocked from creating an allocation 403", s == 403)

        s, _ = call("PUT", "/allocations/cell", mgr, {
            "project_id": ext_id, "user_id": str(fx["outsider_id"]), "week_start_date": monday, "minutes": 600})
        check("cannot allocate a non-member of the project 403", s == 403)

        s, balc = call("PUT", "/allocations/cell", mgr, {
            "project_id": ext_id, "user_id": str(fx["employee_id"]), "week_start_date": monday, "minutes": 2400})
        check("manager sets an allocation", s == 200 and not balc["data"]["deleted"])

        s, bup = call("PUT", "/allocations/cell", mgr, {
            "project_id": ext_id, "user_id": str(fx["employee_id"]), "week_start_date": monday, "minutes": 3200})
        check("re-saving the same cell upserts instead of duplicating", s == 200 and bup["data"]["allocation"]["allocated_minutes"] == 3200)

        s, bdel = call("PUT", "/allocations/cell", mgr, {
            "project_id": ext_id, "user_id": str(fx["employee_id"]), "week_start_date": monday, "minutes": 0})
        check("clearing allocation deletes it", s == 200 and bdel["data"]["deleted"])

    s, butil = call("GET", "/allocations/utilization?weeks=1", emp)
    check("employee utilization loads for own week", s == 200)
    s, _ = call(f"GET", f"/allocations/utilization?weeks=1&user_id={fx['employee_id']}", outsider)
    check("unrelated employee cannot view someone else's utilization 403", s == 403)
    s, _ = call("GET", f"/allocations/utilization?weeks=1&user_id={fx['employee_id']}", mgr)
    check("manager can view direct report's utilization", s == 200)

    print("== expenses ==")
    s, bcat = call("GET", "/expenses/categories", emp)
    check("categories load", s == 200 and len(bcat["data"]) >= 6)
    other_id = next(c["id"] for c in bcat["data"] if c["name"] == "Other")

    s, _ = call("POST", "/expenses", emp, {
        "project_id": str(internal["project_id"]), "category_id": other_id,
        "expense_date": monday, "amount": 0})
    check("zero amount rejected 422", s == 422)

    s, _ = call("POST", "/expenses", emp, {
        "project_id": str(internal["project_id"]), "category_id": other_id,
        "expense_date": monday, "amount": 15.75, "currency": "USD",
        "description": "Parking", "billable": False})
    check("'Other' category without a note rejected 422", s == 422)

    s, bnew = call("POST", "/expenses", emp, {
        "project_id": str(internal["project_id"]), "category_id": other_id,
        "expense_date": monday, "amount": 15.75, "currency": "USD",
        "description": "Parking", "billable": False, "other_category_note": "Parking garage fee"})
    check("employee creates a draft expense under 'Other' with a note", s == 200 and bnew["data"]["status"] == "draft")
    new_expense_id = bnew["data"]["id"]

    s, _ = call("POST", f"/expenses/{new_expense_id}/submit", emp)
    check("employee submits the expense", s == 200)

    s, _ = call("GET", "/expenses/inbox", emp)
    check("employee blocked from expense inbox 403", s == 403)
    s, binbox = call("GET", "/expenses/inbox", mgr)
    check("manager expense inbox includes the new submission", s == 200 and any(e["id"] == new_expense_id for e in binbox["data"]))

    s, _ = call("POST", f"/expenses/{new_expense_id}/decision", mgr, {"action": "reject"})
    check("reject without comment rejected 422", s == 422)
    s, brej = call("POST", f"/expenses/{new_expense_id}/decision", mgr, {"action": "reject", "comment": "Needs a receipt"})
    check("manager rejects with comment", s == 200 and brej["data"]["status"] == "rejected")

    print("== notifications ==")
    s, _ = call("GET", "/notifications")
    check("notifications require auth 401", s == 401)
    s, bnotif_emp = call("GET", "/notifications", emp)
    check("employee was notified of the rejected expense", s == 200 and any(n["type"] == "expense_rejected" for n in bnotif_emp["data"]))
    s, bcount = call("GET", "/notifications/unread-count", emp)
    unread_in_list = sum(1 for n in bnotif_emp["data"] if n["read_at"] is None)
    check("unread count matches unread items in the list", s == 200 and bcount["data"]["count"] == unread_in_list)
    s, _ = call("POST", "/notifications/read-all", emp)
    check("mark-all-read succeeds", s == 200)
    s, bcount2 = call("GET", "/notifications/unread-count", emp)
    check("unread count is zero after mark-all-read", s == 200 and bcount2["data"]["count"] == 0)

    print(f"\n{PASS_COUNT} passed, {len(FAIL)} failed")
    if FAIL:
        print("FAILED:", *FAIL, sep="\n - ")
        sys.exit(1)


if __name__ == "__main__":
    main()
