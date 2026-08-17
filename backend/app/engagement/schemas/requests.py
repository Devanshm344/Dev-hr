from datetime import date
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class SaveCellRequest(BaseModel):
    timesheet_id: str
    project_id: str
    task_id: str | None = None
    work_date: date
    minutes: int = Field(ge=0, le=1440)
    note: str | None = Field(default=None, max_length=1000)


class RemoveRowRequest(BaseModel):
    timesheet_id: str
    project_id: str
    task_id: str | None = None


class WeekendEntryRequest(BaseModel):
    timesheet_id: str
    work_date: date
    reason: str = Field(min_length=1, max_length=1000)


class ReviewDecisionRequest(BaseModel):
    action: str = Field(pattern="^(approve|request_changes)$")
    comment: str | None = Field(default=None, max_length=2000)


class SaveAllocationRequest(BaseModel):
    project_id: str
    user_id: str
    week_start_date: date
    minutes: int = Field(ge=0, le=10080)
    note: str | None = Field(default=None, max_length=1000)


class ExpenseRequest(BaseModel):
    project_id: str
    category_id: str
    expense_date: date
    amount: Decimal = Field(gt=0, le=Decimal("10000000"))
    currency: str = Field(default="INR", min_length=1, max_length=8)
    description: str | None = Field(default=None, max_length=1000)
    billable: bool = True
    receipt_note: str | None = Field(default=None, max_length=500)
    other_category_note: str | None = Field(default=None, max_length=500)


class ExpenseDecisionRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    comment: str | None = Field(default=None, max_length=2000)


class ClientRequest(BaseModel):
    client_code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    currency: str = Field(default="INR", min_length=1, max_length=8)
    status: str = Field(default="active", pattern="^(active|inactive|archived)$")
    notes: str | None = Field(default=None, max_length=2000)


class ProjectRequest(BaseModel):
    project_code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    client_id: str
    description: str | None = Field(default=None, max_length=2000)
    project_manager_id: str | None = None
    project_manager_name: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    status: str = Field(default="active", pattern="^(draft|active|on_hold|completed|cancelled|archived)$")
    billing_model: str = Field(default="time_and_materials", pattern="^(time_and_materials|fixed_fee|non_billable)$")
    currency: str = Field(default="INR", min_length=1, max_length=8)
    budget_amount: Decimal | None = Field(default=None, ge=0, le=Decimal("100000000"))
    member_ids: list[str] = Field(default_factory=list)


class TaskRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    assigned_to: str | None = None
    status: str = Field(default="pending", pattern="^(pending|completed)$")
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
    billable: bool = True


class TaskStatusRequest(BaseModel):
    status: str = Field(pattern="^(pending|completed)$")


class AddMemberRequest(BaseModel):
    user_id: str
    project_role: str = Field(default="member", pattern="^(member|project_manager)$")
