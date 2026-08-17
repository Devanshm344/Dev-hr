from app.engagement.db import dict_cursor


def list_clients_with_projects(conn, *, user_id: str, restrict_to_member: bool) -> list[dict]:
    """Clients with their projects. Employees only see projects they belong to."""
    member_filter = (
        "AND EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = %(user_id)s AND m.active)"
        if restrict_to_member
        else ""
    )
    sql = f"""
        SELECT c.id AS client_id, c.client_code, c.name AS client_name, c.currency AS client_currency,
               c.status AS client_status,
               p.id AS project_id, p.project_code, p.name AS project_name, p.status AS project_status,
               p.billing_model, p.start_date, p.end_date,
               COALESCE(pm.first_name || ' ' || pm.last_name, p.project_manager_name) AS project_manager,
               (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.status NOT IN ('cancelled')) AS task_count,
               (SELECT coalesce(sum(e.duration_minutes),0) FROM time_entries e WHERE e.project_id = p.id) AS logged_minutes
        FROM clients c
        JOIN projects p ON p.client_id = c.id AND p.status <> 'archived' {member_filter}
        LEFT JOIN employees pm ON pm.id = p.project_manager_id
        WHERE c.status <> 'archived'
        ORDER BY c.name, p.name
    """
    with dict_cursor(conn) as cur:
        cur.execute(sql, {"user_id": user_id})
        return [dict(r) for r in cur.fetchall()]


def get_project(conn, project_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT p.id, p.project_code, p.name, p.description, p.status, p.billing_model,
                   p.currency, p.start_date, p.end_date, p.project_manager_id, p.project_manager_name,
                   p.created_by, p.budget_amount,
                   c.id AS client_id, c.name AS client_name,
                   COALESCE(pm.first_name || ' ' || pm.last_name, p.project_manager_name) AS project_manager
            FROM projects p
            JOIN clients c ON c.id = p.client_id
            LEFT JOIN employees pm ON pm.id = p.project_manager_id
            WHERE p.id = %s
            """,
            (project_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_project_by_code(conn, project_code: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute("SELECT id FROM projects WHERE project_code = %s", (project_code,))
        row = cur.fetchone()
        return dict(row) if row else None


def create_project(
    conn,
    *,
    project_code: str,
    name: str,
    client_id: str,
    description: str | None,
    project_manager_id: str | None,
    project_manager_name: str | None,
    created_by: str,
    budget_amount,
    start_date,
    end_date,
    status: str,
    billing_model: str,
    currency: str,
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO projects
                (project_code, name, client_id, description, project_manager_id, project_manager_name,
                 created_by, budget_amount, start_date, end_date, status, billing_model, currency)
            VALUES (%(code)s, %(name)s, %(client)s, %(desc)s, %(pm)s, %(pm_name)s,
                    %(creator)s, %(budget)s, %(start)s, %(end)s, %(status)s, %(billing)s, %(cur)s)
            RETURNING id
            """,
            {
                "code": project_code, "name": name, "client": client_id, "desc": description,
                "pm": project_manager_id, "pm_name": project_manager_name,
                "creator": created_by, "budget": budget_amount, "start": start_date, "end": end_date,
                "status": status, "billing": billing_model, "cur": currency,
            },
        )
        new_id = cur.fetchone()["id"]
    return get_project(conn, new_id)


def update_project(
    conn,
    project_id: str,
    *,
    project_code: str,
    name: str,
    client_id: str,
    description: str | None,
    project_manager_id: str | None,
    project_manager_name: str | None,
    budget_amount,
    start_date,
    end_date,
    status: str,
    billing_model: str,
    currency: str,
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE projects SET
                project_code=%(code)s, name=%(name)s, client_id=%(client)s, description=%(desc)s,
                project_manager_id=%(pm)s, project_manager_name=%(pm_name)s, budget_amount=%(budget)s,
                start_date=%(start)s, end_date=%(end)s,
                status=%(status)s, billing_model=%(billing)s, currency=%(cur)s, updated_at=now()
            WHERE id=%(id)s
            """,
            {
                "id": project_id, "code": project_code, "name": name, "client": client_id, "desc": description,
                "pm": project_manager_id, "pm_name": project_manager_name, "budget": budget_amount,
                "start": start_date, "end": end_date,
                "status": status, "billing": billing_model, "cur": currency,
            },
        )
    return get_project(conn, project_id)


def project_members(conn, project_id: str) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT u.id, u.first_name, u.last_name, u.employee_id AS employee_code, u.title AS job_title,
                   40 AS weekly_capacity_hours
            FROM project_members m
            JOIN employees u ON u.id = m.user_id
            WHERE m.project_id = %s AND m.active AND u.status = 'active'
            ORDER BY u.first_name, u.last_name
            """,
            (project_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def is_member(conn, project_id: str, user_id: str) -> bool:
    with dict_cursor(conn) as cur:
        cur.execute(
            "SELECT 1 FROM project_members WHERE project_id=%s AND user_id=%s AND active",
            (project_id, user_id),
        )
        return cur.fetchone() is not None


def project_tasks(conn, project_id: str) -> list[dict]:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT t.id, t.name, t.status, t.priority, t.billable,
                   t.assigned_to::text AS assigned_to, t.created_by::text AS created_by,
                   a.first_name || ' ' || a.last_name AS assignee,
                   c.first_name || ' ' || c.last_name AS creator_name
            FROM tasks t
            LEFT JOIN employees a ON a.id = t.assigned_to
            LEFT JOIN employees c ON c.id = t.created_by
            WHERE t.project_id = %s
            ORDER BY t.status, t.name
            """,
            (project_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def list_clients(conn) -> list[dict]:
    """Every client, regardless of whether it has any projects yet — for the management UI."""
    with dict_cursor(conn) as cur:
        cur.execute("SELECT id, client_code, name, currency, status, notes FROM clients ORDER BY name")
        return [dict(r) for r in cur.fetchall()]


def get_client(conn, client_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            "SELECT id, client_code, name, currency, status, notes FROM clients WHERE id = %s",
            (client_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_client_by_code(conn, client_code: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute("SELECT id FROM clients WHERE client_code = %s", (client_code,))
        row = cur.fetchone()
        return dict(row) if row else None


def create_client(conn, *, client_code: str, name: str, currency: str, status: str, notes: str | None) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO clients (client_code, name, currency, status, notes)
            VALUES (%(code)s, %(name)s, %(cur)s, %(status)s, %(notes)s)
            RETURNING id, client_code, name, currency, status, notes
            """,
            {"code": client_code, "name": name, "cur": currency, "status": status, "notes": notes},
        )
        return dict(cur.fetchone())


def update_client(
    conn, client_id: str, *, client_code: str, name: str, currency: str, status: str, notes: str | None
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE clients SET client_code=%(code)s, name=%(name)s, currency=%(cur)s,
                                status=%(status)s, notes=%(notes)s, updated_at=now()
            WHERE id=%(id)s
            RETURNING id, client_code, name, currency, status, notes
            """,
            {"id": client_id, "code": client_code, "name": name, "cur": currency, "status": status, "notes": notes},
        )
        return dict(cur.fetchone())


def get_task_by_name(conn, project_id: str, name: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            "SELECT id FROM tasks WHERE project_id = %s AND lower(name) = lower(%s)",
            (project_id, name),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_task(conn, task_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT t.id, t.project_id, t.name, t.description, t.status, t.priority, t.billable,
                   t.assigned_to, t.created_by, a.first_name || ' ' || a.last_name AS assignee
            FROM tasks t
            LEFT JOIN employees a ON a.id = t.assigned_to
            WHERE t.id = %s
            """,
            (task_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def create_task(
    conn, project_id: str, *, name: str, description: str | None, assigned_to: str | None,
    status: str, priority: str, billable: bool, created_by: str,
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            INSERT INTO tasks (project_id, name, description, assigned_to, status, priority, billable, created_by)
            VALUES (%(p)s, %(name)s, %(desc)s, %(assignee)s, %(status)s, %(priority)s, %(billable)s, %(creator)s)
            RETURNING id
            """,
            {
                "p": project_id, "name": name, "desc": description, "assignee": assigned_to,
                "status": status, "priority": priority, "billable": billable, "creator": created_by,
            },
        )
        new_id = cur.fetchone()["id"]
    return get_task(conn, new_id)


def update_task(
    conn, task_id: str, *, name: str, description: str | None, assigned_to: str | None,
    status: str, priority: str, billable: bool,
) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            UPDATE tasks SET name=%(name)s, description=%(desc)s, assigned_to=%(assignee)s,
                             status=%(status)s, priority=%(priority)s, billable=%(billable)s, updated_at=now()
            WHERE id=%(id)s
            """,
            {
                "id": task_id, "name": name, "desc": description, "assignee": assigned_to,
                "status": status, "priority": priority, "billable": billable,
            },
        )
    return get_task(conn, task_id)


def set_task_status(conn, task_id: str, *, status: str) -> dict:
    with dict_cursor(conn) as cur:
        cur.execute(
            "UPDATE tasks SET status=%(status)s, updated_at=now() WHERE id=%(id)s",
            {"id": task_id, "status": status},
        )
    return get_task(conn, task_id)


_ROLE_CASE = """
    CASE
        WHEN ur.system_role IN ('Admin', 'Super Admin') THEN 'admin'
        WHEN EXISTS (SELECT 1 FROM employees mgr WHERE mgr.manager_id = u.id) THEN 'manager'
        ELSE 'employee'
    END AS role
"""


def get_active_user(conn, user_id: str) -> dict | None:
    with dict_cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT u.id, {_ROLE_CASE}
            FROM employees u LEFT JOIN user_roles ur ON ur.employee_id = u.employee_id
            WHERE u.id = %s AND u.status = 'active'
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def list_active_users(conn) -> list[dict]:
    """Every active person — for the project manager / assignee / add-member pickers."""
    with dict_cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT u.id::text AS id, u.first_name, u.last_name, u.employee_id AS employee_code,
                   u.title AS job_title, u.manager_id::text AS manager_id, {_ROLE_CASE}
            FROM employees u LEFT JOIN user_roles ur ON ur.employee_id = u.employee_id
            WHERE u.status = 'active'
            ORDER BY u.first_name, u.last_name
            """
        )
        return [dict(r) for r in cur.fetchall()]


def add_member(conn, project_id: str, user_id: str, project_role: str) -> dict:
    """Reactivates and relabels the existing history row for this pair if one exists, else inserts fresh."""
    with dict_cursor(conn) as cur:
        cur.execute(
            "SELECT id FROM project_members WHERE project_id = %s AND user_id = %s",
            (project_id, user_id),
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                """
                UPDATE project_members SET active = true, project_role = %s
                WHERE id = %s
                RETURNING id, project_id, user_id, project_role, active
                """,
                (project_role, existing["id"]),
            )
        else:
            cur.execute(
                """
                INSERT INTO project_members (project_id, user_id, project_role, active)
                VALUES (%s, %s, %s, true)
                RETURNING id, project_id, user_id, project_role, active
                """,
                (project_id, user_id, project_role),
            )
        return dict(cur.fetchone())


def remove_member(conn, project_id: str, user_id: str) -> int:
    """Deactivates rather than deletes, so membership history is preserved."""
    with dict_cursor(conn) as cur:
        cur.execute(
            "UPDATE project_members SET active = false WHERE project_id = %s AND user_id = %s AND active",
            (project_id, user_id),
        )
        return cur.rowcount


def my_project_task_options(conn, user_id: str) -> list[dict]:
    """Projects the user can log time to, with open tasks — feeds Add Time Row."""
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT p.id AS project_id, p.name AS project_name, c.name AS client_name,
                   p.billing_model, p.project_manager_id, p.created_by AS project_created_by,
                   t.id AS task_id, t.name AS task_name, t.description AS task_description,
                   t.billable AS task_billable, t.status AS task_status, t.priority AS task_priority,
                   t.assigned_to AS task_assigned_to, t.created_by AS task_created_by,
                   a.first_name || ' ' || a.last_name AS task_assignee
            FROM projects p
            JOIN clients c ON c.id = p.client_id
            JOIN project_members m ON m.project_id = p.id AND m.user_id = %s AND m.active
            LEFT JOIN tasks t ON t.project_id = p.id AND t.status NOT IN ('cancelled','completed')
            LEFT JOIN employees a ON a.id = t.assigned_to
            WHERE p.status = 'active'
            ORDER BY c.name, p.name, t.name
            """,
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]
