from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, PerformanceReview
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role
from app.services.notifications import create_notification

router = APIRouter()

class ReviewCreate(BaseModel):
    employee_id: int
    review_period: str
    review_type: str = "quarterly"
    goals_rating: float
    skills_rating: float
    behavior_rating: float
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    goals_next_period: Optional[str] = None

def review_to_dict(r):
    return {
        "id": r.id,
        "employee_id": r.employee_id,
        "employee_name": f"{r.employee.first_name} {r.employee.last_name}" if r.employee else None,
        "reviewer_id": r.reviewer_id,
        "reviewer_name": f"{r.reviewer.first_name} {r.reviewer.last_name}" if r.reviewer else None,
        "review_period": r.review_period,
        "review_type": r.review_type,
        "goals_rating": r.goals_rating,
        "skills_rating": r.skills_rating,
        "behavior_rating": r.behavior_rating,
        "overall_rating": r.overall_rating,
        "strengths": r.strengths,
        "improvements": r.improvements,
        "goals_next_period": r.goals_next_period,
        "status": r.status,
        "created_at": str(r.created_at) if r.created_at else None,
    }

@router.post("/")
def create_review(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user)
):
    employee = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_self = data.employee_id == current_user.id
    is_direct_manager = employee.manager_id == current_user.id
    is_admin = is_admin_role(get_effective_role(current_user, auth_db))
    if not (is_self or is_direct_manager or is_admin):
        raise HTTPException(status_code=403, detail="You can only submit a self-review, or review your direct reports")

    overall = round((data.goals_rating + data.skills_rating + data.behavior_rating) / 3, 2)
    review = PerformanceReview(
        employee_id=data.employee_id,
        reviewer_id=current_user.id,
        review_period=data.review_period,
        review_type=data.review_type,
        goals_rating=data.goals_rating,
        skills_rating=data.skills_rating,
        behavior_rating=data.behavior_rating,
        overall_rating=overall,
        strengths=data.strengths,
        improvements=data.improvements,
        goals_next_period=data.goals_next_period,
        # A self-review is a draft pending the manager's own review; only a manager/admin
        # entry counts as the completed, official review.
        status="self_review" if is_self else "completed"
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    if is_self and employee.manager_id:
        create_notification(
            db, user_id=employee.manager_id, type="performance_self_review_submitted",
            title=f"{employee.first_name} {employee.last_name} submitted a self-review",
            body=f"{data.review_period} ({data.review_type})",
            link="/performance",
        )
        db.commit()
    elif not is_self:
        create_notification(
            db, user_id=data.employee_id, type="performance_review_completed",
            title="A performance review has been completed for you",
            body=f"{data.review_period} ({data.review_type}) — overall rating {overall}",
            link="/performance",
        )
        db.commit()
    return review_to_dict(review)

@router.get("/my")
def get_my_reviews(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    reviews = db.query(PerformanceReview).filter(PerformanceReview.employee_id == current_user.id).all()
    return [review_to_dict(r) for r in reviews]

@router.get("/team")
def get_team_reviews(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    """Reviews for employees who report directly to the logged-in manager, determined
    solely via Employee.manager_id (no role check) — mirrors leave.py's /team-pending."""
    reports = db.query(Employee).filter(Employee.manager_id == current_user.id).all()
    report_ids = [e.id for e in reports]
    reviews = (
        db.query(PerformanceReview)
        .filter(PerformanceReview.employee_id.in_(report_ids))
        .order_by(PerformanceReview.created_at.desc())
        .all()
        if report_ids else []
    )
    return {
        "is_manager": len(reports) > 0,
        "direct_reports": [{"id": e.id, "name": f"{e.first_name} {e.last_name}"} for e in reports],
        "reviews": [review_to_dict(r) for r in reviews],
    }

@router.get("/all")
def get_all_reviews(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    reviews = db.query(PerformanceReview).all()
    return [review_to_dict(r) for r in reviews]
