from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from app.db.database import get_db
from app.models.base import Employee, UserRole
from app.core.security import get_current_user

router = APIRouter()

# system_role (from user_roles) -> org chart display tier
_ROLE_MAP = {
    "Super Admin": "super_admin",
    "Admin": "hr_admin",
    "Employee": "employee",
}


@router.get("/")
def get_org_chart(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    employees = (
        db.query(Employee)
        .filter(Employee.status.in_(["active", "on_leave"]))
        .order_by(Employee.id)
        .all()
    )

    emp_ids = [e.employee_id for e in employees if e.employee_id]
    role_map = {
        ur.employee_id: ur.system_role
        for ur in db.query(UserRole).filter(UserRole.employee_id.in_(emp_ids)).all()
    } if emp_ids else {}

    return [
        {
            "id": str(e.id),
            "name": f"{e.first_name or ''} {e.last_name or ''}".strip(),
            "job_title": e.title or e.job_role or "",
            "department": e.department.name if e.department else None,
            "avatar_initials": (
                ((e.first_name or " ")[0] + (e.last_name or " ")[0]).upper()
            ),
            "profile_picture": e.profile_picture,
            "manager_id": str(e.manager_id) if e.manager_id else None,
            "role": _ROLE_MAP.get(role_map.get(e.employee_id, "Employee"), "employee"),
            "email": e.email,
            "employee_id": e.employee_id,
        }
        for e in employees
    ]

@router.get("/search")
def search_org_chart(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    if not q or len(q.strip()) < 1:
        return []
    search = q.strip()
    candidates = db.query(Employee).filter(
        or_(
            Employee.employee_id.ilike(f"{search}%"),
            Employee.first_name.ilike(f"%{search}%"),
            Employee.last_name.ilike(f"%{search}%"),
        )
    ).limit(20).all()
    q_lower = search.lower()
    matched = [
        e for e in candidates
        if e.employee_id.lower().startswith(q_lower)
        or f"{e.first_name} {e.last_name}".lower().find(q_lower) >= 0
    ][:8]
    return [
        {
            "id": e.id,
            "empId": e.employee_id,
            "name": f"{e.first_name} {e.last_name}",
            "designation": e.title or e.job_role or "",
            "department": e.department.name if e.department else "",
            "profile_picture": e.profile_picture,
        }
        for e in matched
    ]


@router.get("/chain/{employee_db_id}")
def get_org_chain(
    employee_db_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    if not db.query(Employee.id).filter(Employee.id == employee_db_id).first():
        raise HTTPException(status_code=404, detail="Employee not found")

    # Single recursive CTE — fetches the employee and every ancestor in one round-trip.
    # Rows are ordered level DESC so the CEO (highest level) comes first.
    chain_sql = text("""
        WITH RECURSIVE chain AS (
            SELECT id, employee_id, first_name, last_name,
                   title, job_role, department_id, manager_id,
                   profile_picture, 0 AS level
            FROM employees
            WHERE id = :emp_id
            UNION ALL
            SELECT e.id, e.employee_id, e.first_name, e.last_name,
                   e.title, e.job_role, e.department_id, e.manager_id,
                   e.profile_picture, c.level + 1
            FROM employees e
            INNER JOIN chain c ON e.id = c.manager_id
            WHERE c.level < 50
        )
        SELECT c.id, c.employee_id, c.first_name, c.last_name,
               c.title, c.job_role, c.manager_id, c.profile_picture,
               c.level, d.name AS department_name
        FROM chain c
        LEFT JOIN departments d ON c.department_id = d.id
        ORDER BY c.level DESC
    """)

    rows = db.execute(chain_sql, {"emp_id": employee_db_id}).mappings().all()

    def row_to_node(row):
        return {
            "id": row["id"],
            "empId": row["employee_id"],
            "name": f"{row['first_name']} {row['last_name']}",
            "designation": row["title"] or row["job_role"] or "",
            "department": row["department_name"] or "",
            "profile_picture": row["profile_picture"],
            "isCEO": row["manager_id"] is None,
        }

    manager_chain = []
    selected_node = None
    for row in rows:
        node = row_to_node(row)
        if row["id"] == employee_db_id:
            selected_node = node
        else:
            manager_chain.append(node)  # ordered: CEO first, direct manager last

    # Direct reportees — single query, no N+1
    reportees = (
        db.query(Employee)
        .filter(
            Employee.manager_id == employee_db_id,
            Employee.status.in_(["active", "on_leave"]),
        )
        .order_by(Employee.first_name, Employee.last_name)
        .all()
    )

    def emp_to_reportee(e):
        return {
            "id": e.id,
            "empId": e.employee_id,
            "name": f"{e.first_name} {e.last_name}",
            "designation": e.title or e.job_role or "",
            "department": e.department.name if e.department else "",
            "profile_picture": e.profile_picture,
        }

    return {
        "employee": selected_node,
        "managerChain": manager_chain,
        "reportees": [emp_to_reportee(r) for r in reportees],
    }
