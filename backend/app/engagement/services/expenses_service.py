from datetime import date
from decimal import Decimal

from app.engagement.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationFailedError
from app.engagement.repositories import approvals_repo, expenses_repo, notifications_repo, portfolio_repo

EDITABLE_STATUSES = {"draft", "rejected"}
DECISION_ACTIONS = {"approve": "approved", "reject": "rejected"}


def _owned_editable(conn, user: dict, expense_id: str) -> dict:
    exp = expenses_repo.get(conn, expense_id)
    if exp is None:
        raise NotFoundError("Expense not found")
    if str(exp["user_id"]) != str(user["id"]):
        raise ForbiddenError("This expense belongs to another person")
    if exp["status"] not in EDITABLE_STATUSES:
        raise ConflictError(f"A {exp['status']} expense can no longer be edited")
    return exp


def _validate_fields(
    conn, user_id: str, *, project_id: str, category_id: str, expense_date: date, amount: Decimal,
    other_category_note: str | None,
) -> str | None:
    """Returns the other_category_note to actually store (required + kept for "Other", discarded otherwise)."""
    project = portfolio_repo.get_project(conn, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    if project["status"] in ("archived", "cancelled", "completed"):
        raise ValidationFailedError("Expenses cannot be logged to this project anymore")
    if not portfolio_repo.is_member(conn, project_id, user_id):
        raise ForbiddenError("You are not a member of this project")
    category = expenses_repo.get_category(conn, category_id)
    if category is None or not category["active"]:
        raise ValidationFailedError("Select a valid expense category")
    if amount <= 0:
        raise ValidationFailedError("Amount must be greater than zero")
    if expense_date > date.today():
        raise ValidationFailedError("Expense date cannot be in the future")
    if category["name"].strip().lower() == "other":
        if not other_category_note or not other_category_note.strip():
            raise ValidationFailedError("Describe what this 'Other' expense category is")
        return other_category_note.strip()
    return None


def create(
    conn,
    user: dict,
    *,
    project_id: str,
    category_id: str,
    expense_date: date,
    amount: Decimal,
    currency: str,
    description: str | None,
    billable: bool,
    receipt_note: str | None,
    other_category_note: str | None,
) -> dict:
    other_category_note = _validate_fields(
        conn, user["id"], project_id=project_id, category_id=category_id,
        expense_date=expense_date, amount=amount, other_category_note=other_category_note,
    )
    return expenses_repo.create(
        conn, user_id=user["id"], project_id=project_id, category_id=category_id,
        expense_date=expense_date, amount=amount, currency=currency,
        description=description, billable=billable, receipt_note=receipt_note,
        other_category_note=other_category_note,
    )


def update(
    conn,
    user: dict,
    expense_id: str,
    *,
    project_id: str,
    category_id: str,
    expense_date: date,
    amount: Decimal,
    currency: str,
    description: str | None,
    billable: bool,
    receipt_note: str | None,
    other_category_note: str | None,
) -> dict:
    _owned_editable(conn, user, expense_id)
    other_category_note = _validate_fields(
        conn, user["id"], project_id=project_id, category_id=category_id,
        expense_date=expense_date, amount=amount, other_category_note=other_category_note,
    )
    return expenses_repo.update_draft(
        conn, expense_id, project_id=project_id, category_id=category_id,
        expense_date=expense_date, amount=amount, currency=currency,
        description=description, billable=billable, receipt_note=receipt_note,
        other_category_note=other_category_note,
    )


def delete(conn, user: dict, expense_id: str) -> None:
    _owned_editable(conn, user, expense_id)
    expenses_repo.delete(conn, expense_id)


def submit(conn, user: dict, expense_id: str) -> dict:
    exp = _owned_editable(conn, user, expense_id)
    result = expenses_repo.submit(conn, expense_id)

    if user.get("manager_id"):
        notifications_repo.create(
            conn,
            user_id=user["manager_id"],
            type="expense_submitted",
            title=f"{user['first_name']} {user['last_name']} submitted an expense",
            body=f"{exp['currency']} {exp['amount']} — {exp['category_name']}",
            link="/engagement/expenses",
        )
    return result


def _authorize_subject(conn, user: dict, exp: dict) -> dict:
    owner = approvals_repo.user_brief(conn, exp["user_id"])
    if owner is None:
        raise NotFoundError("Expense not found")
    if user["role"] != "admin" and str(owner["manager_id"]) != str(user["id"]):
        raise ForbiddenError("You can only review your direct reports' expenses")
    return owner


def get_detail(conn, user: dict, expense_id: str) -> dict:
    exp = expenses_repo.get(conn, expense_id)
    if exp is None:
        raise NotFoundError("Expense not found")
    if str(exp["user_id"]) == str(user["id"]):
        return exp
    _authorize_subject(conn, user, exp)
    return exp


def decide(conn, user: dict, expense_id: str, action: str, comment: str | None) -> dict:
    if action not in DECISION_ACTIONS:
        raise ValidationFailedError("action must be 'approve' or 'reject'")
    exp = expenses_repo.get(conn, expense_id)
    if exp is None:
        raise NotFoundError("Expense not found")
    _authorize_subject(conn, user, exp)
    if exp["status"] != "submitted":
        raise ConflictError(f"A {exp['status']} expense cannot be reviewed")
    if action == "reject" and not (comment and comment.strip()):
        raise ValidationFailedError("A comment is required when rejecting")

    new_status = DECISION_ACTIONS[action]
    result = expenses_repo.set_decision(conn, expense_id, new_status, user["id"], comment)

    notifications_repo.create(
        conn,
        user_id=exp["user_id"],
        type="expense_approved" if action == "approve" else "expense_rejected",
        title="Expense approved" if action == "approve" else "Expense rejected",
        body=f"{exp['currency']} {exp['amount']} — {exp['category_name']}" + (f": {comment}" if comment else ""),
        link="/engagement/expenses",
    )
    return result
