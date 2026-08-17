"""One-time fix: wire up each real employee's manager_id to match the actual
company reporting hierarchy, then lay the chart out cleanly.

Two real data sources are combined, matched to employees.employee_id (the
original company ID preserved verbatim by import_employees.py — e.g. "133",
"100311" — so matching is an exact key join, not fuzzy name-matching):

  1. orgxlsx.json (in this repo)   — l1_id: each person's direct manager,
     covering ~158 employees including individual contributors.
  2. the org-chart-editor reference project's store.py seed — fills in the
     handful of senior manager-to-manager links (e.g. VP -> CEO) that
     orgxlsx.json doesn't include, since that project was seeded from the
     same original org chart export.

Run once:
    python sync_orgchart_hierarchy.py            # apply
    python sync_orgchart_hierarchy.py --dry-run   # preview only
"""
import argparse
import importlib.util
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import SessionLocal
from app.models.base import Employee, OrgChartLayout

ORGXLSX_PATH = os.path.join(os.path.dirname(__file__), "..", "orgxlsx.json")
REFERENCE_STORE_PATH = os.environ.get(
    "ORGCHART_REFERENCE_STORE",
    r"C:\Users\mshinde\Downloads\orgchart-editor-master (1)\orgchart-editor-master\org-chart-editor\backend\store.py",
)


def load_manager_of_by_employee_id():
    manager_of = {}

    with open(ORGXLSX_PATH, "r", encoding="utf-8") as f:
        for row in json.load(f):
            if row.get("l1_id"):
                manager_of[row["emp_id"]] = row["l1_id"]

    if os.path.exists(REFERENCE_STORE_PATH):
        spec = importlib.util.spec_from_file_location("reference_store", REFERENCE_STORE_PATH)
        reference = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(reference)
        for seed_emp in reference._SEED_EMPLOYEES:
            if seed_emp["id"] not in manager_of and seed_emp["reportingManagerId"]:
                manager_of[seed_emp["id"]] = seed_emp["reportingManagerId"]
        compute_auto_layout = reference._compute_auto_layout
    else:
        print(f"[warn] reference store not found at {REFERENCE_STORE_PATH}; "
              f"senior manager-to-manager links may be incomplete.")
        compute_auto_layout = None

    return manager_of, compute_auto_layout


def main(dry_run):
    manager_of_by_eid, compute_auto_layout = load_manager_of_by_employee_id()

    db = SessionLocal()
    employees = db.query(Employee).all()
    by_employee_id = {e.employee_id: e for e in employees if e.employee_id}

    updated = []
    unmatched_employee = []
    unmatched_manager = []

    for eid, mgr_eid in manager_of_by_eid.items():
        emp = by_employee_id.get(eid)
        if not emp:
            unmatched_employee.append(eid)
            continue
        mgr = by_employee_id.get(mgr_eid)
        if not mgr:
            unmatched_manager.append((eid, mgr_eid))
            continue
        updated.append((emp, mgr))

    print(f"Resolved {len(updated)} manager links out of {len(manager_of_by_eid)} reference rows.")
    if unmatched_employee:
        print(f"  {len(unmatched_employee)} reference employee IDs have no matching real employee (skipped).")
    if unmatched_manager:
        print(f"  {len(unmatched_manager)} reference rows have a manager ID with no matching real employee (skipped).")

    if dry_run:
        print("Dry run — no changes written.")
        db.close()
        return

    for emp, mgr in updated:
        emp.manager_id = mgr.id
        emp.reporting_manager_name = f"{mgr.first_name or ''} {mgr.last_name or ''}".strip()
    db.commit()

    if compute_auto_layout:
        placed_ids = {emp.id for emp, _ in updated} | {mgr.id for _, mgr in updated}
        placed_for_layout = [
            {
                "id": e.id,
                "name": f"{e.first_name or ''} {e.last_name or ''}".strip(),
                "reportingManagerId": e.manager_id if e.manager_id in placed_ids else None,
            }
            for e in employees
            if e.id in placed_ids
        ]
        positions = compute_auto_layout(placed_for_layout)

        for eid in placed_ids:
            if eid not in positions:
                continue
            x, y = positions[eid]
            layout = db.query(OrgChartLayout).filter(OrgChartLayout.employee_id == eid).first()
            if not layout:
                layout = OrgChartLayout(employee_id=eid)
                db.add(layout)
            layout.position_x = x
            layout.position_y = y
            layout.in_chart = True
        db.commit()
        print(f"Laid out {len(placed_ids)} employees on the canvas.")

    db.close()
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(args.dry_run)
