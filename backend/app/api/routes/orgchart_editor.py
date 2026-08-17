import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db, get_auth_db
from app.models.base import Department, Employee, OrgChartLayout
from app.core.security import get_current_admin
from app.api.routes.employees import EmployeeCreate, EmployeeUpdate, create_employee, update_employee

router = APIRouter()


class PlaceRequest(BaseModel):
    positionX: float
    positionY: float


class MoveRequest(BaseModel):
    positionX: float
    positionY: float


class ManagerRequest(BaseModel):
    managerId: Optional[str] = None


class QuickAddEmployeeRequest(BaseModel):
    name: str
    role: str
    department: str


def _get_employee_or_404(db: Session, employee_id: str) -> Employee:
    emp = db.query(Employee).filter(Employee.id == int(employee_id)).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


def _get_or_create_layout(db: Session, employee_id: int) -> OrgChartLayout:
    layout = db.query(OrgChartLayout).filter(OrgChartLayout.employee_id == employee_id).first()
    if not layout:
        layout = OrgChartLayout(employee_id=employee_id, in_chart=False)
        db.add(layout)
    return layout


def _avatar(emp: Employee) -> str:
    initials = ((emp.first_name or " ")[0] + (emp.last_name or " ")[0]).upper()
    return initials.strip() or "?"


def _node(emp: Employee, layout: Optional[OrgChartLayout]) -> dict:
    return {
        "id": str(emp.id),
        "name": f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
        "role": emp.title or emp.job_role or "",
        "department": emp.department.name if emp.department else "Unassigned",
        "avatar": _avatar(emp),
        "reportingManagerId": str(emp.manager_id) if emp.manager_id else None,
        "positionX": layout.position_x if layout else None,
        "positionY": layout.position_y if layout else None,
        "inChart": bool(layout and layout.in_chart),
    }


def _would_create_cycle(db: Session, employee_id: int, new_manager_id: int) -> bool:
    current = new_manager_id
    visited = set()
    while current is not None:
        if current == employee_id:
            return True
        if current in visited:
            break
        visited.add(current)
        mgr = db.query(Employee).filter(Employee.id == current).first()
        current = mgr.manager_id if mgr else None
    return False


@router.post("/employees", status_code=201)
def add_employee(
    payload: QuickAddEmployeeRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    """Create a real employee record from the editor's quick-add form.

    The form only collects name/title/department, so this fills in the rest
    (employee ID, email, password) the same way the full Employees page's
    creation flow does — it calls that flow directly rather than
    re-implementing employee creation.
    """
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    dept = db.query(Department).filter(Department.name == payload.department).first()
    if not dept:
        raise HTTPException(status_code=400, detail=f"Unknown department '{payload.department}'")

    first_name, _, last_name = name.partition(" ")

    # Derive a placeholder email from the admin's own domain rather than a
    # hardcoded company domain, so this works for any tenant.
    domain = current_user.email.split("@")[-1] if current_user.email and "@" in current_user.email else "example.com"
    slug = re.sub(r"[^a-z0-9]", "", name.lower()) or "employee"
    email = f"{slug}@{domain}"
    suffix = 1
    while db.query(Employee).filter(Employee.email == email).first():
        suffix += 1
        email = f"{slug}{suffix}@{domain}"

    create_data = EmployeeCreate(
        first_name=first_name,
        last_name=last_name,
        email=email,
        title=payload.role,
        job_role=payload.role,
        department_id=dept.id,
    )
    created = create_employee(create_data, db, current_user)
    emp = db.query(Employee).filter(Employee.id == created["id"]).first()
    return _node(emp, None)


@router.patch("/employees/{employee_id}/details")
def edit_employee(
    employee_id: str,
    payload: QuickAddEmployeeRequest,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_admin),
):
    """Update name/title/department from the editor's quick-edit form.

    Same fields as the quick-add form; forwards to the real Employees page's
    update logic instead of re-implementing it.
    """
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    dept = db.query(Department).filter(Department.name == payload.department).first()
    if not dept:
        raise HTTPException(status_code=400, detail=f"Unknown department '{payload.department}'")

    first_name, _, last_name = name.partition(" ")

    update_data = EmployeeUpdate(
        first_name=first_name,
        last_name=last_name or "",
        title=payload.role,
        job_role=payload.role,
        department_id=dept.id,
    )
    update_employee(int(employee_id), update_data, db, auth_db, current_user)
    emp = _get_employee_or_404(db, employee_id)
    layout = db.query(OrgChartLayout).filter(OrgChartLayout.employee_id == emp.id).first()
    return _node(emp, layout)


@router.get("/chart")
def get_chart(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    layouts = {l.employee_id: l for l in db.query(OrgChartLayout).filter(OrgChartLayout.in_chart.is_(True)).all()}
    employees = (
        db.query(Employee)
        .filter(Employee.id.in_(layouts.keys()))
        .filter(Employee.status.in_(["active", "on_leave"]))
        .all()
    )
    nodes = [_node(e, layouts.get(e.id)) for e in employees]
    node_ids = {n["id"] for n in nodes}
    edges = [
        {"source": n["reportingManagerId"], "target": n["id"]}
        for n in nodes
        if n["reportingManagerId"] and n["reportingManagerId"] in node_ids
    ]
    return {"nodes": nodes, "edges": edges}


@router.get("/unassigned")
def get_unassigned(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    placed_ids = {
        l.employee_id
        for l in db.query(OrgChartLayout).filter(OrgChartLayout.in_chart.is_(True)).all()
    }
    employees = (
        db.query(Employee)
        .filter(Employee.status.in_(["active", "on_leave"]))
        .order_by(Employee.first_name, Employee.last_name)
        .all()
    )
    return [_node(e, None) for e in employees if e.id not in placed_ids]


@router.patch("/employees/{employee_id}/place")
def place_employee(
    employee_id: str,
    payload: PlaceRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = _get_employee_or_404(db, employee_id)
    layout = _get_or_create_layout(db, emp.id)
    layout.position_x = payload.positionX
    layout.position_y = payload.positionY
    layout.in_chart = True
    db.commit()
    return _node(emp, layout)


@router.patch("/employees/{employee_id}/move")
def move_employee(
    employee_id: str,
    payload: MoveRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = _get_employee_or_404(db, employee_id)
    layout = _get_or_create_layout(db, emp.id)
    layout.position_x = payload.positionX
    layout.position_y = payload.positionY
    db.commit()
    return _node(emp, layout)


@router.patch("/employees/{employee_id}/manager")
def set_manager(
    employee_id: str,
    payload: ManagerRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = _get_employee_or_404(db, employee_id)

    if payload.managerId is None:
        emp.manager_id = None
        emp.reporting_manager_name = None
        db.commit()
        layout = db.query(OrgChartLayout).filter(OrgChartLayout.employee_id == emp.id).first()
        return _node(emp, layout)

    manager_id = int(payload.managerId)
    if manager_id == emp.id:
        raise HTTPException(status_code=400, detail="An employee cannot report to themselves")

    manager = _get_employee_or_404(db, payload.managerId)
    manager_layout = db.query(OrgChartLayout).filter(OrgChartLayout.employee_id == manager.id).first()
    if not manager_layout or not manager_layout.in_chart:
        raise HTTPException(status_code=400, detail="Manager must be placed in the org chart")

    if _would_create_cycle(db, emp.id, manager_id):
        raise HTTPException(status_code=400, detail="This assignment would create a reporting cycle")

    emp.manager_id = manager_id
    emp.reporting_manager_name = f"{manager.first_name or ''} {manager.last_name or ''}".strip()
    db.commit()
    layout = db.query(OrgChartLayout).filter(OrgChartLayout.employee_id == emp.id).first()
    return _node(emp, layout)


@router.delete("/employees/{employee_id}/manager")
def remove_manager(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = _get_employee_or_404(db, employee_id)
    emp.manager_id = None
    emp.reporting_manager_name = None
    db.commit()
    layout = db.query(OrgChartLayout).filter(OrgChartLayout.employee_id == emp.id).first()
    return _node(emp, layout)


@router.patch("/employees/{employee_id}/remove-from-chart")
def remove_from_chart(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    emp = _get_employee_or_404(db, employee_id)
    layout = _get_or_create_layout(db, emp.id)
    layout.in_chart = False
    layout.position_x = None
    layout.position_y = None
    emp.manager_id = None
    emp.reporting_manager_name = None

    for other in db.query(Employee).filter(Employee.manager_id == emp.id).all():
        other.manager_id = None
        other.reporting_manager_name = None

    db.commit()
    return _node(emp, layout)
