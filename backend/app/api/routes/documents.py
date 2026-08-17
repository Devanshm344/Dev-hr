from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from pathlib import Path
import shutil, os, uuid
from app.db.database import get_db, get_auth_db
from app.models.base import Employee, Document
from app.core.security import get_current_user, get_effective_role, is_admin_role
from app.core.config import settings
from app.services.notifications import create_notification

router = APIRouter()

@router.get("/my")
def get_my_documents(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.employee_id == current_user.id).all()
    return [doc_to_dict(d) for d in docs]

@router.get("/employee/{employee_id}")
def get_employee_documents(employee_id: int, db: Session = Depends(get_db), auth_db: Session = Depends(get_auth_db), current_user: Employee = Depends(get_current_user)):
    if current_user.id != employee_id and not is_admin_role(get_effective_role(current_user, auth_db)):
        raise HTTPException(status_code=403, detail="Permission denied")
    docs = db.query(Document).filter(Document.employee_id == employee_id).all()
    return [doc_to_dict(d) for d in docs]

@router.post("/upload")
async def upload_document(
    employee_id: int = Form(...),
    title: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    upload_dir = Path(settings.UPLOAD_DIR) / str(employee_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    ext = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / unique_name
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    doc = Document(
        employee_id=employee_id,
        title=title,
        document_type=document_type,
        file_path=str(file_path),
        file_name=file.filename,
        file_size=os.path.getsize(file_path),
        uploaded_by=current_user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    if current_user.id != employee_id:
        create_notification(
            db, user_id=employee_id, type="document_uploaded",
            title="A new document was added to your profile",
            body=title,
            link="/documents",
        )
        db.commit()
    return doc_to_dict(doc)

@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db), auth_db: Session = Depends(get_auth_db), current_user: Employee = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.employee_id != current_user.id and not is_admin_role(get_effective_role(current_user, auth_db)):
        raise HTTPException(status_code=403, detail="Permission denied")
    if doc.file_path and Path(doc.file_path).exists():
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}

def doc_to_dict(d):
    return {
        "id": d.id,
        "employee_id": d.employee_id,
        "title": d.title,
        "document_type": d.document_type,
        "file_name": d.file_name,
        "file_size": d.file_size,
        "uploaded_by": d.uploaded_by,
        "created_at": str(d.created_at) if d.created_at else None,
    }
