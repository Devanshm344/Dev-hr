from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from app.db.database import get_db
from app.models.base import Employee, Attendance, LeaveRequest, Payslip, PerformanceReview, Document, Announcement, Department
from app.core.security import get_current_user

router = APIRouter()


@router.get("/stats")
def get_module_stats(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    today = date.today()
    now = datetime.now()
    month_start = date(today.year, today.month, 1)
    week_start = today - timedelta(days=today.weekday())
    quarter_month = ((today.month - 1) // 3) * 3 + 1
    quarter_start = date(today.year, quarter_month, 1)

    # --- Employees ---
    total_employees = db.query(Employee).count()
    active_employees = db.query(Employee).filter(Employee.status == "active").count()
    on_leave_employees = db.query(Employee).filter(Employee.status == "on_leave").count()
    new_this_month = db.query(Employee).filter(Employee.created_at >= datetime(today.year, today.month, 1)).count()

    # --- Attendance ---
    present_today = db.query(Attendance).filter(Attendance.date == today).count()
    checked_in_now = db.query(Attendance).filter(
        Attendance.date == today,
        Attendance.check_in.isnot(None),
        Attendance.check_out.is_(None)
    ).count()
    this_week_records = db.query(Attendance).filter(Attendance.date >= week_start).all()
    avg_hours_week = 0.0
    if this_week_records:
        hours = [r.work_hours or 0 for r in this_week_records if r.work_hours]
        avg_hours_week = round(sum(hours) / len(hours), 1) if hours else 0.0
    month_att_count = db.query(Attendance).filter(Attendance.date >= month_start).count()

    # --- Leave ---
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == "pending").count()
    approved_this_month = db.query(LeaveRequest).filter(
        LeaveRequest.status == "approved",
        LeaveRequest.created_at >= datetime(today.year, today.month, 1)
    ).count()

    # --- Payroll ---
    payslips_this_month = db.query(Payslip).filter(
        Payslip.month == today.month,
        Payslip.year == today.year
    ).count()
    paid_this_month = db.query(Payslip).filter(
        Payslip.month == today.month,
        Payslip.year == today.year,
        Payslip.status == "paid"
    ).count()
    pending_payment = payslips_this_month - paid_this_month

    # --- Performance ---
    total_reviews = db.query(PerformanceReview).count()
    reviews_this_quarter = db.query(PerformanceReview).filter(
        PerformanceReview.created_at >= datetime(today.year, quarter_month, 1)
    ).count()
    avg_rating = 0.0
    all_reviews = db.query(PerformanceReview).all()
    if all_reviews:
        ratings = [r.overall_rating for r in all_reviews if r.overall_rating]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

    # --- Documents ---
    total_docs = db.query(Document).count()
    docs_this_month = db.query(Document).filter(
        Document.created_at >= datetime(today.year, today.month, 1)
    ).count()

    # --- Announcements ---
    active_announcements = db.query(Announcement).filter(Announcement.is_active == True).count()
    this_week_ann = db.query(Announcement).filter(
        Announcement.created_at >= datetime(week_start.year, week_start.month, week_start.day)
    ).count()

    # --- Departments ---
    total_departments = db.query(Department).count()

    return {
        "timestamp": now.isoformat(),
        "employees": {
            "total": total_employees,
            "active": active_employees,
            "on_leave": on_leave_employees,
            "new_this_month": new_this_month,
        },
        "attendance": {
            "present_today": present_today,
            "checked_in_now": checked_in_now,
            "avg_hours_week": avg_hours_week,
            "records_this_month": month_att_count,
        },
        "leave": {
            "pending": pending_leaves,
            "approved_this_month": approved_this_month,
        },
        "payroll": {
            "generated_this_month": payslips_this_month,
            "paid_this_month": paid_this_month,
            "pending_payment": pending_payment,
        },
        "performance": {
            "total_reviews": total_reviews,
            "this_quarter": reviews_this_quarter,
            "avg_rating": avg_rating,
        },
        "documents": {
            "total": total_docs,
            "this_month": docs_this_month,
        },
        "announcements": {
            "active": active_announcements,
            "this_week": this_week_ann,
        },
        "departments": {
            "total": total_departments,
        },
    }
