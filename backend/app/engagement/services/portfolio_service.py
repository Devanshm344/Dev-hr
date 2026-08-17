from datetime import date

from app.engagement.exceptions import ForbiddenError, NotFoundError, ValidationFailedError
from app.engagement.repositories import notifications_repo, portfolio_repo


def is_project_manager(user: dict, project: dict) -> bool:
    """Admin, the project's current manager, or whoever created it."""
    if user["role"] == "admin":
        return True
    if project.get("project_manager_id") and str(project["project_manager_id"]) == str(user["id"]):
        return True
    if project.get("created_by") and str(project["created_by"]) == str(user["id"]):
        return True
    return False


def authorize_project_editor(user: dict, project: dict) -> None:
    """Only an admin, this project's manager, or its creator, may edit it."""
    if not is_project_manager(user, project):
        raise ForbiddenError("Only an admin, this project's manager, or its creator can make this change")


def _validated_manager(conn, project_manager_id: str | None) -> None:
    if not project_manager_id:
        return
    pm = portfolio_repo.get_active_user(conn, project_manager_id)
    if pm is None or pm["role"] not in ("manager", "admin"):
        raise ValidationFailedError("The project manager must be an active manager or admin")


def _validate_dates(start_date: date | None, end_date: date | None) -> None:
    if start_date and end_date and end_date < start_date:
        raise ValidationFailedError("End date must be on or after the start date")


def _validate_manager_fields(project_manager_id: str | None, project_manager_name: str | None) -> None:
    if project_manager_id and project_manager_name:
        raise ValidationFailedError(
            "Choose an existing manager or enter a name, not both"
        )


def create_client(conn, *, client_code: str, name: str, currency: str, status: str, notes: str | None) -> dict:
    if portfolio_repo.get_client_by_code(conn, client_code) is not None:
        raise ValidationFailedError("That client code is already in use")
    return portfolio_repo.create_client(conn, client_code=client_code, name=name, currency=currency,
                                         status=status, notes=notes)


def update_client(
    conn, client_id: str, *, client_code: str, name: str, currency: str, status: str, notes: str | None
) -> dict:
    if portfolio_repo.get_client(conn, client_id) is None:
        raise NotFoundError("Client not found")
    other = portfolio_repo.get_client_by_code(conn, client_code)
    if other is not None and str(other["id"]) != str(client_id):
        raise ValidationFailedError("That client code is already in use")
    return portfolio_repo.update_client(conn, client_id, client_code=client_code, name=name,
                                         currency=currency, status=status, notes=notes)


def create_project(
    conn, user: dict, *, project_code: str, name: str, client_id: str, description: str | None,
    project_manager_id: str | None, project_manager_name: str | None,
    budget_amount, start_date: date | None, end_date: date | None,
    status: str, billing_model: str, currency: str, member_ids: list[str] | None = None,
) -> dict:
    if portfolio_repo.get_client(conn, client_id) is None:
        raise NotFoundError("Client not found")
    # A manager who doesn't hand the project to someone else becomes its PM.
    if user["role"] == "manager" and not project_manager_id and not project_manager_name:
        project_manager_id = user["id"]
    _validated_manager(conn, project_manager_id)
    _validate_manager_fields(project_manager_id, project_manager_name)
    if portfolio_repo.get_project_by_code(conn, project_code) is not None:
        raise ValidationFailedError("That project code is already in use")
    _validate_dates(start_date, end_date)
    # Dedup against the PM up front — they're added with role "project_manager" below,
    # and re-adding them here as a plain "member" would demote that role.
    extra_member_ids = {str(m) for m in (member_ids or []) if str(m) != str(project_manager_id)}
    for member_id in extra_member_ids:
        if portfolio_repo.get_active_user(conn, member_id) is None:
            raise ValidationFailedError("One of the selected members is not an active employee")
    project = portfolio_repo.create_project(
        conn, project_code=project_code, name=name, client_id=client_id, description=description,
        project_manager_id=project_manager_id, project_manager_name=project_manager_name,
        created_by=user["id"], budget_amount=budget_amount, start_date=start_date, end_date=end_date,
        status=status, billing_model=billing_model, currency=currency,
    )
    if project_manager_id:
        # So the assigned manager can log time on it right away, without a separate "add member" step.
        portfolio_repo.add_member(conn, project["id"], project_manager_id, "project_manager")
    for member_id in extra_member_ids:
        portfolio_repo.add_member(conn, project["id"], member_id, "member")
    return project


def update_project(
    conn, user: dict, project_id: str, *, project_code: str, name: str, client_id: str,
    description: str | None, project_manager_id: str | None, project_manager_name: str | None,
    budget_amount, start_date: date | None, end_date: date | None,
    status: str, billing_model: str, currency: str,
) -> dict:
    existing = portfolio_repo.get_project(conn, project_id)
    if existing is None:
        raise NotFoundError("Project not found")
    authorize_project_editor(user, existing)
    if portfolio_repo.get_client(conn, client_id) is None:
        raise NotFoundError("Client not found")
    _validated_manager(conn, project_manager_id)
    _validate_manager_fields(project_manager_id, project_manager_name)
    other = portfolio_repo.get_project_by_code(conn, project_code)
    if other is not None and str(other["id"]) != str(project_id):
        raise ValidationFailedError("That project code is already in use")
    _validate_dates(start_date, end_date)
    return portfolio_repo.update_project(
        conn, project_id, project_code=project_code, name=name, client_id=client_id,
        description=description, project_manager_id=project_manager_id,
        project_manager_name=project_manager_name, budget_amount=budget_amount, start_date=start_date,
        end_date=end_date, status=status, billing_model=billing_model, currency=currency,
    )


def _editable_project(conn, user: dict, project_id: str) -> dict:
    project = portfolio_repo.get_project(conn, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    authorize_project_editor(user, project)
    return project


def _validated_assignee(conn, assigned_to: str | None) -> None:
    if assigned_to and portfolio_repo.get_active_user(conn, assigned_to) is None:
        raise ValidationFailedError("Select a valid assignee")


def can_create_task(conn, user: dict, project: dict) -> bool:
    """Admin/PM always. On an internal (non-billable) project, any active member may add tasks."""
    if is_project_manager(user, project):
        return True
    return project["billing_model"] == "non_billable" and portfolio_repo.is_member(conn, project["id"], user["id"])


def can_edit_task(user: dict, project: dict, task: dict) -> bool:
    """Admin/PM always. On an internal project, the task's own creator may edit it."""
    if is_project_manager(user, project):
        return True
    return (
        project["billing_model"] == "non_billable"
        and task["created_by"] is not None
        and str(task["created_by"]) == str(user["id"])
    )


def can_set_task_status(user: dict, project: dict, task: dict) -> bool:
    """Anyone who can fully edit the task, plus its assignee — who otherwise has no edit
    rights at all, but must be able to mark their own task done."""
    if can_edit_task(user, project, task):
        return True
    return task["assigned_to"] is not None and str(task["assigned_to"]) == str(user["id"])


def create_task(
    conn, user: dict, project_id: str, *, name: str, description: str | None, assigned_to: str | None,
    status: str, priority: str, billable: bool,
) -> dict:
    project = portfolio_repo.get_project(conn, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    if not can_create_task(conn, user, project):
        raise ForbiddenError("Only an admin, this project's manager, or (on internal projects) a member can add tasks")
    if portfolio_repo.get_task_by_name(conn, project_id, name) is not None:
        raise ValidationFailedError("A task with that name already exists on this project")
    _validated_assignee(conn, assigned_to)
    task = portfolio_repo.create_task(conn, project_id, name=name, description=description,
                                       assigned_to=assigned_to, status=status, priority=priority, billable=billable,
                                       created_by=user["id"])
    _notify_assignee(conn, user, project, task, previous_assignee=None)
    return task


def update_task(
    conn, user: dict, task_id: str, *, name: str, description: str | None, assigned_to: str | None,
    status: str, priority: str, billable: bool,
) -> dict:
    task = portfolio_repo.get_task(conn, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    project = portfolio_repo.get_project(conn, task["project_id"])
    if not can_edit_task(user, project, task):
        raise ForbiddenError("Only an admin, this project's manager, or the task's creator can edit it")
    other = portfolio_repo.get_task_by_name(conn, task["project_id"], name)
    if other is not None and str(other["id"]) != str(task_id):
        raise ValidationFailedError("A task with that name already exists on this project")
    _validated_assignee(conn, assigned_to)
    previous_assignee = task["assigned_to"]
    updated = portfolio_repo.update_task(conn, task_id, name=name, description=description,
                                          assigned_to=assigned_to, status=status, priority=priority, billable=billable)
    _notify_assignee(conn, user, project, updated, previous_assignee=previous_assignee)
    return updated


def _notify_assignee(conn, user: dict, project: dict, task: dict, *, previous_assignee) -> None:
    """Notify the assignee on a fresh assignment or a re-assignment to someone new — never on
    self-assignment or when the assignee hasn't actually changed."""
    assigned_to = task["assigned_to"]
    if not assigned_to or str(assigned_to) == str(user["id"]) or str(assigned_to) == str(previous_assignee):
        return
    notifications_repo.create(
        conn,
        user_id=assigned_to,
        type="task_assigned",
        title=f"{user['first_name']} {user['last_name']} assigned you a task",
        body=f"{task['name']} — {project['name']}",
        link=f"/engagement/portfolio/projects/{project['id']}",
    )


def set_task_status(conn, user: dict, task_id: str, *, status: str) -> dict:
    task = portfolio_repo.get_task(conn, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    project = portfolio_repo.get_project(conn, task["project_id"])
    if not can_set_task_status(user, project, task):
        raise ForbiddenError("Only this task's assignee, an admin, or this project's manager can change its status")
    return portfolio_repo.set_task_status(conn, task_id, status=status)


def add_member(conn, user: dict, project_id: str, *, target_user_id: str, project_role: str) -> dict:
    _editable_project(conn, user, project_id)
    if portfolio_repo.get_active_user(conn, target_user_id) is None:
        raise ValidationFailedError("Select a valid person to add")
    return portfolio_repo.add_member(conn, project_id, target_user_id, project_role)


def remove_member(conn, user: dict, project_id: str, target_user_id: str) -> None:
    _editable_project(conn, user, project_id)
    removed = portfolio_repo.remove_member(conn, project_id, target_user_id)
    if removed == 0:
        raise NotFoundError("This person is not an active member of the project")
