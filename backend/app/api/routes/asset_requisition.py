from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import date
import json, os, uuid, shutil, re
from pathlib import Path
from app.db.database import get_db, get_auth_db
from app.models.base import (
    Employee, Department,
    AssetRequisition, AssetRequisitionStatusEnum,
    AssetTicket, ARAttachment, ARStatusHistory, ARTicketStatusEnum,
)
from app.core.security import get_current_user, get_current_admin, get_effective_role, is_admin_role
from app.core.config import settings

router = APIRouter()

# ── Static master data ────────────────────────────────────────────────────────

ASSET_TYPES = [
    "Laptop", "Desktop", "Monitor", "Keyboard", "Mouse",
    "Headset", "Mobile Phone", "Tablet", "Access Card",
    "Office Chair", "Other",
]

SERVICE_TYPES = [
    "Laptop Request",
    "Desktop Request",
    "Printer Request",
    "Software Installation",
    "Asset Replacement",
    "Asset Repair",
    "New Equipment Request",
    "Monitor Request",
    "Keyboard & Mouse",
    "Headset Request",
    "Mobile Phone Request",
    "Tablet Request",
    "Access Card Request",
    "Other",
]

CLASSIFICATIONS = [
    "Hardware",
    "Software",
    "Infrastructure",
    "Network",
    "Accessories",
    "Other",
]

TICKET_PRIORITIES = ["low", "medium", "high", "critical"]

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AssetRequisitionCreate(BaseModel):
    asset_type: str
    quantity: int = 1
    purpose: str
    priority: str = "normal"
    required_by: Optional[date] = None
    notes: Optional[str] = None


class AssetRequisitionUpdate(BaseModel):
    asset_type: Optional[str] = None
    quantity: Optional[int] = None
    purpose: Optional[str] = None
    priority: Optional[str] = None
    required_by: Optional[date] = None
    notes: Optional[str] = None


class AssetRequisitionApproval(BaseModel):
    status: str
    rejection_reason: Optional[str] = None


class TicketCreate(BaseModel):
    department_id: Optional[int] = None
    service_type: Optional[str] = None
    classification: Optional[str] = None
    subject: str
    description: str
    priority: str = "medium"
    cc_emails: Optional[List[str]] = []


class TicketUpdate(BaseModel):
    department_id: Optional[int] = None
    service_type: Optional[str] = None
    classification: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    cc_emails: Optional[List[str]] = None


# ── Serializers ───────────────────────────────────────────────────────────────

def req_to_dict(r: AssetRequisition):
    return {
        "id": r.id,
        "employee_id": r.employee_id,
        "employee_name": f"{r.employee.first_name} {r.employee.last_name}" if r.employee else None,
        "asset_type": r.asset_type,
        "quantity": r.quantity,
        "purpose": r.purpose,
        "priority": r.priority,
        "required_by": str(r.required_by) if r.required_by else None,
        "status": r.status.value if r.status else "pending",
        "approved_by": r.approved_by,
        "approver": f"{r.approver.first_name} {r.approver.last_name}" if r.approver else None,
        "approved_at": str(r.approved_at) if r.approved_at else None,
        "rejection_reason": r.rejection_reason,
        "fulfilled_at": str(r.fulfilled_at) if r.fulfilled_at else None,
        "notes": r.notes,
        "created_at": str(r.created_at) if r.created_at else None,
        "updated_at": str(r.updated_at) if r.updated_at else None,
    }


def ticket_to_dict(t: AssetTicket, include_history: bool = False):
    result = {
        "id": t.id,
        "ticket_number": t.ticket_number,
        "employee_id": t.employee_id,
        "employee_name": f"{t.employee.first_name} {t.employee.last_name}" if t.employee else None,
        "department_id": t.department_id,
        "department_name": t.department.name if t.department else None,
        "service_type": t.service_type,
        "classification": t.classification,
        "subject": t.subject,
        "description": t.description,
        "priority": t.priority,
        "status": t.status.value if t.status else "open",
        "cc_emails": json.loads(t.cc_emails) if t.cc_emails else [],
        "attachments": [
            {
                "id": a.id,
                "file_name": a.file_name,
                "file_size": a.file_size,
                "mime_type": a.mime_type,
            }
            for a in (t.attachments or [])
        ],
        "created_at": str(t.created_at) if t.created_at else None,
        "updated_at": str(t.updated_at) if t.updated_at else None,
    }
    if include_history:
        result["status_history"] = [
            {
                "id": h.id,
                "old_status": h.old_status,
                "new_status": h.new_status,
                "remarks": h.remarks,
                "changed_by": h.changed_by,
                "changer_name": (
                    f"{h.changer.first_name} {h.changer.last_name}"
                    if h.changer else None
                ),
                "changed_at": str(h.changed_at) if h.changed_at else None,
            }
            for h in (t.status_history or [])
        ]
    return result


# ── Legacy asset-types endpoint ───────────────────────────────────────────────

@router.get("/asset-types")
def get_asset_types():
    return ASSET_TYPES


# ── Legacy create / list endpoints ────────────────────────────────────────────

@router.post("/")
def create_asset_requisition(
    data: AssetRequisitionCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = AssetRequisition(
        **data.dict(),
        employee_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req_to_dict(req)


@router.get("/my")
def get_my_requisitions(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    requests = (
        db.query(AssetRequisition)
        .filter(AssetRequisition.employee_id == current_user.id)
        .order_by(AssetRequisition.created_at.desc())
        .all()
    )
    return [req_to_dict(r) for r in requests]


@router.get("/all")
def get_all_requisitions(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    requests = db.query(AssetRequisition).order_by(AssetRequisition.created_at.desc()).all()
    return [req_to_dict(r) for r in requests]


# ── Ticket master data  (must be declared before /{request_id}) ───────────────

@router.get("/departments")
def get_ticket_departments(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    depts = db.query(Department).order_by(Department.name).all()
    return [{"id": d.id, "name": d.name} for d in depts]


@router.get("/service-types")
def get_service_types(current_user: Employee = Depends(get_current_user)):
    return SERVICE_TYPES


@router.get("/classifications")
def get_classifications(current_user: Employee = Depends(get_current_user)):
    return CLASSIFICATIONS


@router.get("/priorities")
def get_priorities(current_user: Employee = Depends(get_current_user)):
    return TICKET_PRIORITIES


# ── Ticket CRUD (all static paths declared before /{request_id}) ──────────────

@router.post("/tickets")
def create_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if not data.subject or not data.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required")
    plain = re.sub(r"<[^>]+>", "", data.description or "").strip()
    if not plain:
        raise HTTPException(status_code=400, detail="Description is required")

    ticket = AssetTicket(
        ticket_number="TEMP",
        employee_id=current_user.id,
        department_id=data.department_id,
        service_type=data.service_type or None,
        classification=data.classification or None,
        subject=data.subject.strip(),
        description=data.description,
        priority=data.priority or "medium",
        cc_emails=json.dumps(data.cc_emails or []),
        created_by=current_user.id,
    )
    db.add(ticket)
    db.flush()                                  # get ticket.id before commit
    ticket.ticket_number = f"AST-{ticket.id:06d}"
    db.add(ARStatusHistory(
        ticket_id=ticket.id,
        old_status=None,
        new_status="open",
        remarks="Ticket created",
        changed_by=current_user.id,
    ))
    db.commit()
    db.refresh(ticket)
    return ticket_to_dict(ticket)


@router.get("/tickets")
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    tickets = (
        db.query(AssetTicket)
        .filter(AssetTicket.employee_id == current_user.id)
        .order_by(AssetTicket.created_at.desc())
        .all()
    )
    return [ticket_to_dict(t) for t in tickets]


@router.get("/tickets/all")
def get_all_tickets(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    tickets = db.query(AssetTicket).order_by(AssetTicket.created_at.desc()).all()
    return [ticket_to_dict(t) for t in tickets]


@router.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and ticket.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return ticket_to_dict(ticket, include_history=True)


@router.put("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if ticket.status.value != "open":
        raise HTTPException(status_code=400, detail="Only open tickets can be edited")

    updates = data.dict(exclude_none=True)
    for field, value in updates.items():
        if field == "cc_emails":
            ticket.cc_emails = json.dumps(value)
        else:
            setattr(ticket, field, value)
    ticket.updated_by = current_user.id
    db.commit()
    db.refresh(ticket)
    return ticket_to_dict(ticket)


@router.put("/tickets/{ticket_id}/cancel")
def cancel_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if ticket.status.value != "open":
        raise HTTPException(status_code=400, detail="Only open tickets can be cancelled")

    old_status = ticket.status.value
    ticket.status = ARTicketStatusEnum.cancelled
    ticket.updated_by = current_user.id
    db.add(ARStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status="cancelled",
        remarks="Cancelled by employee",
        changed_by=current_user.id,
    ))
    db.commit()
    return {"message": "Ticket cancelled successfully"}


TICKET_STATUS_TRANSITIONS = {
    "open":        {"in_progress", "cancelled"},
    "in_progress": {"pending", "resolved", "cancelled"},
    "pending":     {"in_progress", "resolved", "cancelled"},
    "resolved":    {"closed", "in_progress"},
}


class TicketStatusUpdate(BaseModel):
    status: str
    remarks: Optional[str] = None


@router.put("/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    data: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    old_status = ticket.status.value
    allowed = TICKET_STATUS_TRANSITIONS.get(old_status, set())
    if data.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot move ticket from '{old_status}' to '{data.status}'")

    ticket.status = ARTicketStatusEnum(data.status)
    ticket.updated_by = current_user.id
    db.add(ARStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=data.status,
        remarks=data.remarks,
        changed_by=current_user.id,
    ))
    db.commit()
    db.refresh(ticket)
    return ticket_to_dict(ticket)


@router.get("/tickets/{ticket_id}/history")
def get_ticket_history(
    ticket_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and ticket.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return [
        {
            "id": h.id,
            "old_status": h.old_status,
            "new_status": h.new_status,
            "remarks": h.remarks,
            "changed_by": h.changed_by,
            "changer_name": (
                f"{h.changer.first_name} {h.changer.last_name}"
                if h.changer else None
            ),
            "changed_at": str(h.changed_at) if h.changed_at else None,
        }
        for h in ticket.status_history
    ]


@router.post("/tickets/{ticket_id}/attachments")
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    upload_dir = Path(settings.UPLOAD_DIR) / "asset-tickets" / str(ticket_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix
    file_path = upload_dir / f"{uuid.uuid4()}{ext}"

    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    file_size = os.path.getsize(file_path)
    if file_size > settings.MAX_UPLOAD_SIZE:
        os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE // (1024 * 1024)} MB allowed",
        )

    att = ARAttachment(
        ticket_id=ticket_id,
        file_name=file.filename,
        file_path=str(file_path),
        file_size=file_size,
        mime_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return {"id": att.id, "file_name": att.file_name, "file_size": att.file_size, "mime_type": att.mime_type}


@router.get("/tickets/{ticket_id}/attachments")
def get_attachments(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return [
        {"id": a.id, "file_name": a.file_name, "file_size": a.file_size, "mime_type": a.mime_type}
        for a in ticket.attachments
    ]


@router.delete("/tickets/{ticket_id}/attachments/{att_id}")
def delete_attachment(
    ticket_id: int,
    att_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    ticket = db.query(AssetTicket).filter(AssetTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    att = (
        db.query(ARAttachment)
        .filter(ARAttachment.id == att_id, ARAttachment.ticket_id == ticket_id)
        .first()
    )
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if att.file_path and os.path.exists(att.file_path):
        os.remove(att.file_path)
    db.delete(att)
    db.commit()
    return {"message": "Attachment deleted"}


# ── Legacy parameterised endpoints  (MUST remain after all static paths) ──────

@router.get("/{request_id}")
def get_requisition(
    request_id: int,
    db: Session = Depends(get_db),
    auth_db: Session = Depends(get_auth_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(AssetRequisition).filter(AssetRequisition.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Asset requisition not found")
    effective_role = get_effective_role(current_user, auth_db)
    if not is_admin_role(effective_role) and req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return req_to_dict(req)


@router.put("/{request_id}")
def update_requisition(
    request_id: int,
    data: AssetRequisitionUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(AssetRequisition).filter(AssetRequisition.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Asset requisition not found")
    if req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if req.status.value not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")
    for field, value in data.dict(exclude_none=True).items():
        setattr(req, field, value)
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return req_to_dict(req)


@router.delete("/{request_id}")
def cancel_requisition(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    req = db.query(AssetRequisition).filter(AssetRequisition.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Asset requisition not found")
    if req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if req.status.value not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")
    req.status = AssetRequisitionStatusEnum.cancelled
    req.updated_by = current_user.id
    db.commit()
    return {"message": "Asset requisition cancelled"}


@router.put("/{request_id}/approve")
def approve_requisition(
    request_id: int,
    data: AssetRequisitionApproval,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    from datetime import datetime
    req = db.query(AssetRequisition).filter(AssetRequisition.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Asset requisition not found")
    if data.status not in ("approved", "rejected", "fulfilled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    req.status = AssetRequisitionStatusEnum(data.status)
    req.approved_by = current_user.id
    req.approved_at = datetime.utcnow()
    req.rejection_reason = data.rejection_reason
    if data.status == "fulfilled":
        req.fulfilled_at = datetime.utcnow()
    req.updated_by = current_user.id
    db.commit()
    db.refresh(req)
    return req_to_dict(req)
