from fastapi import APIRouter, Depends

from app.engagement.db import get_db
from app.engagement.deps import get_current_user, require_roles
from app.engagement.exceptions import ForbiddenError, NotFoundError
from app.engagement.repositories import portfolio_repo
from app.engagement.schemas.requests import (
    AddMemberRequest, ClientRequest, ProjectRequest, TaskRequest, TaskStatusRequest,
)
from app.engagement.services import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])
manager_or_admin = require_roles("manager", "admin")


@router.get("/overview")
def portfolio_overview(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    restrict = user["role"] == "employee"
    rows = portfolio_repo.list_clients_with_projects(
        conn, user_id=user["id"], restrict_to_member=restrict
    )
    clients: dict[str, dict] = {}
    for r in rows:
        c = clients.setdefault(
            str(r["client_id"]),
            {
                "id": r["client_id"],
                "client_code": r["client_code"],
                "name": r["client_name"],
                "currency": r["client_currency"],
                "status": r["client_status"],
                "projects": [],
            },
        )
        c["projects"].append(
            {
                "id": r["project_id"],
                "project_code": r["project_code"],
                "name": r["project_name"],
                "status": r["project_status"],
                "billing_model": r["billing_model"],
                "start_date": r["start_date"],
                "end_date": r["end_date"],
                "project_manager": r["project_manager"],
                "task_count": r["task_count"],
                "logged_minutes": int(r["logged_minutes"]),
            }
        )
    return {"data": list(clients.values())}


@router.get("/projects/{project_id}")
def project_detail(project_id: str, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    project = portfolio_repo.get_project(conn, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    if user["role"] == "employee" and not portfolio_repo.is_member(conn, project_id, user["id"]):
        raise ForbiddenError("You are not a member of this project")
    project["tasks"] = portfolio_repo.project_tasks(conn, project_id)
    project["members"] = portfolio_repo.project_members(conn, project_id)
    project["can_edit"] = portfolio_service.is_project_manager(user, project)
    project["can_add_tasks"] = portfolio_service.can_create_task(conn, user, project)
    for t in project["tasks"]:
        t["can_edit"] = portfolio_service.can_edit_task(user, project, t)
        t["can_set_status"] = portfolio_service.can_set_task_status(user, project, t)
    return {"data": project}


@router.get("/time-row-options")
def time_row_options(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    rows = portfolio_repo.my_project_task_options(conn, user["id"])
    projects: dict[str, dict] = {}
    for r in rows:
        p = projects.setdefault(
            str(r["project_id"]),
            {
                "id": r["project_id"],
                "project_id": r["project_id"],
                "project_name": r["project_name"],
                "client_name": r["client_name"],
                "billing_model": r["billing_model"],
                "project_manager_id": r["project_manager_id"],
                "can_add_tasks": portfolio_service.can_create_task(
                    conn, user, {"id": r["project_id"], "billing_model": r["billing_model"],
                                 "project_manager_id": r["project_manager_id"],
                                 "created_by": r["project_created_by"]}
                ),
                "tasks": [],
            },
        )
        if r["task_id"] is not None:
            task = {
                "id": r["task_id"],
                "created_by": r["task_created_by"],
            }
            p["tasks"].append(
                {
                    "task_id": r["task_id"],
                    "task_name": r["task_name"],
                    "description": r["task_description"],
                    "billable": r["task_billable"],
                    "status": r["task_status"],
                    "priority": r["task_priority"],
                    "assigned_to": r["task_assigned_to"],
                    "assignee": r["task_assignee"],
                    "can_edit": portfolio_service.can_edit_task(user, p, task),
                }
            )
    return {"data": list(projects.values())}


@router.get("/users")
def list_users(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    return {"data": portfolio_repo.list_active_users(conn)}


@router.get("/clients")
def list_clients(user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    return {"data": portfolio_repo.list_clients(conn)}


@router.post("/clients")
def create_client(body: ClientRequest, user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    result = portfolio_service.create_client(
        conn, client_code=body.client_code, name=body.name, currency=body.currency,
        status=body.status, notes=body.notes,
    )
    return {"data": result, "message": "Client created"}


@router.put("/clients/{client_id}")
def update_client(client_id: str, body: ClientRequest, user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    result = portfolio_service.update_client(
        conn, client_id, client_code=body.client_code, name=body.name, currency=body.currency,
        status=body.status, notes=body.notes,
    )
    return {"data": result, "message": "Client updated"}


@router.post("/projects")
def create_project(body: ProjectRequest, user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    result = portfolio_service.create_project(
        conn, user, project_code=body.project_code, name=body.name, client_id=body.client_id,
        description=body.description, project_manager_id=body.project_manager_id,
        project_manager_name=body.project_manager_name, budget_amount=body.budget_amount,
        start_date=body.start_date, end_date=body.end_date, status=body.status,
        billing_model=body.billing_model, currency=body.currency, member_ids=body.member_ids,
    )
    return {"data": result, "message": "Project created"}


@router.put("/projects/{project_id}")
def update_project(
    project_id: str, body: ProjectRequest, user: dict = Depends(manager_or_admin), conn=Depends(get_db)
):
    result = portfolio_service.update_project(
        conn, user, project_id, project_code=body.project_code, name=body.name, client_id=body.client_id,
        description=body.description, project_manager_id=body.project_manager_id,
        project_manager_name=body.project_manager_name, budget_amount=body.budget_amount,
        start_date=body.start_date, end_date=body.end_date, status=body.status,
        billing_model=body.billing_model, currency=body.currency,
    )
    return {"data": result, "message": "Project updated"}


@router.post("/projects/{project_id}/tasks")
def create_task(
    project_id: str, body: TaskRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)
):
    result = portfolio_service.create_task(
        conn, user, project_id, name=body.name, description=body.description,
        assigned_to=body.assigned_to, status=body.status, priority=body.priority, billable=body.billable,
    )
    return {"data": result, "message": "Task created"}


@router.put("/tasks/{task_id}")
def update_task(task_id: str, body: TaskRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    result = portfolio_service.update_task(
        conn, user, task_id, name=body.name, description=body.description,
        assigned_to=body.assigned_to, status=body.status, priority=body.priority, billable=body.billable,
    )
    return {"data": result, "message": "Task updated"}


@router.patch("/tasks/{task_id}/status")
def set_task_status(
    task_id: str, body: TaskStatusRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)
):
    result = portfolio_service.set_task_status(conn, user, task_id, status=body.status)
    return {"data": result, "message": "Task updated"}


@router.post("/projects/{project_id}/members")
def add_member(
    project_id: str, body: AddMemberRequest, user: dict = Depends(manager_or_admin), conn=Depends(get_db)
):
    result = portfolio_service.add_member(
        conn, user, project_id, target_user_id=body.user_id, project_role=body.project_role,
    )
    return {"data": result, "message": "Member added"}


@router.delete("/projects/{project_id}/members/{member_user_id}")
def remove_member(
    project_id: str, member_user_id: str, user: dict = Depends(manager_or_admin), conn=Depends(get_db)
):
    portfolio_service.remove_member(conn, user, project_id, member_user_id)
    return {"data": None, "message": "Member removed"}
