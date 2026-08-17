from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.models.base import Employee, Announcement, StatusEnum
from app.core.security import get_current_user, get_current_admin
from app.services.notifications import create_notification

router = APIRouter()

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    category: Optional[str] = "general"
    priority: str = "normal"
    expires_at: Optional[datetime] = None

@router.get("/")
def get_announcements(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    announcements = db.query(Announcement).filter(Announcement.is_active == True).order_by(Announcement.created_at.desc()).limit(20).all()
    return [{
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "category": a.category,
        "priority": a.priority,
        "published_by": a.published_by,
        "publisher": f"{a.publisher.first_name} {a.publisher.last_name}" if a.publisher else None,
        "created_at": str(a.created_at) if a.created_at else None,
        "expires_at": str(a.expires_at) if a.expires_at else None,
    } for a in announcements]

@router.post("/")
def create_announcement(data: AnnouncementCreate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    ann = Announcement(
        title=data.title,
        content=data.content,
        category=data.category,
        priority=data.priority,
        published_by=current_user.id,
        expires_at=data.expires_at
    )
    db.add(ann)
    db.flush()  # assigns ann.id before any notification links to it

    recipient_ids = [
        row[0] for row in db.query(Employee.id)
        .filter(Employee.status == StatusEnum.active, Employee.id != current_user.id)
        .all()
    ]
    for employee_id in recipient_ids:
        create_notification(
            db, user_id=employee_id, type="announcement_posted",
            title=data.title,
            body=data.content[:200],
            link="/announcements",
        )

    db.commit()
    db.refresh(ann)
    return ann

@router.delete("/{ann_id}")
def delete_announcement(ann_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_admin)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Not found")
    ann.is_active = False
    db.commit()
    return {"message": "Announcement removed"}
