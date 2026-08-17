from fastapi import APIRouter, Depends

from app.engagement.db import get_db
from app.engagement.deps import get_current_user, require_roles
from app.engagement.repositories import expenses_repo
from app.engagement.schemas.requests import ExpenseDecisionRequest, ExpenseRequest
from app.engagement.services import expenses_service

router = APIRouter(prefix="/expenses", tags=["expenses"])
manager_or_admin = require_roles("manager", "admin")


@router.get("/categories")
def categories(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    return {"data": expenses_repo.list_categories(conn)}


@router.get("/my")
def my_expenses(user: dict = Depends(get_current_user), conn=Depends(get_db)):
    return {"data": expenses_repo.my_expenses(conn, user["id"])}


@router.get("/inbox")
def inbox(user: dict = Depends(manager_or_admin), conn=Depends(get_db)):
    return {"data": expenses_repo.inbox(conn, user["id"])}


@router.get("/{expense_id}")
def detail(expense_id: str, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    return {"data": expenses_service.get_detail(conn, user, expense_id)}


@router.post("")
def create(body: ExpenseRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    result = expenses_service.create(
        conn,
        user,
        project_id=body.project_id,
        category_id=body.category_id,
        expense_date=body.expense_date,
        amount=body.amount,
        currency=body.currency,
        description=body.description,
        billable=body.billable,
        receipt_note=body.receipt_note,
        other_category_note=body.other_category_note,
    )
    return {"data": result, "message": "Expense saved"}


@router.put("/{expense_id}")
def update(expense_id: str, body: ExpenseRequest, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    result = expenses_service.update(
        conn,
        user,
        expense_id,
        project_id=body.project_id,
        category_id=body.category_id,
        expense_date=body.expense_date,
        amount=body.amount,
        currency=body.currency,
        description=body.description,
        billable=body.billable,
        receipt_note=body.receipt_note,
        other_category_note=body.other_category_note,
    )
    return {"data": result, "message": "Expense updated"}


@router.delete("/{expense_id}")
def remove(expense_id: str, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    expenses_service.delete(conn, user, expense_id)
    return {"data": None, "message": "Expense deleted"}


@router.post("/{expense_id}/submit")
def submit(expense_id: str, user: dict = Depends(get_current_user), conn=Depends(get_db)):
    result = expenses_service.submit(conn, user, expense_id)
    return {"data": result, "message": "Expense submitted"}


@router.post("/{expense_id}/decision")
def decide(
    expense_id: str,
    body: ExpenseDecisionRequest,
    user: dict = Depends(manager_or_admin),
    conn=Depends(get_db),
):
    result = expenses_service.decide(conn, user, expense_id, body.action, body.comment)
    message = "Expense approved" if body.action == "approve" else "Expense rejected"
    return {"data": result, "message": message}
