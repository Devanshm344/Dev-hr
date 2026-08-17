from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional
from pydantic import BaseModel
from datetime import date, timedelta
from app.db.database import get_db
from app.models.base import Asset, AssetAssignment, AssetCategoryEnum, AssetStatusEnum, Employee
from app.core.security import get_current_user, get_current_admin
from app.services.notifications import create_notification

router = APIRouter()

CATEGORY_PREFIX = {
    "laptop": "LT",
    "mobile_phone": "MB",
    "access_card": "AC",
    "monitor": "MN",
    "vehicle": "VH",
    "furniture": "FR",
    "other": "OT",
}

CATEGORY_LABELS = {
    "laptop": "Laptops",
    "mobile_phone": "Mobile phones",
    "access_card": "Access cards",
    "monitor": "Monitors",
    "vehicle": "Vehicles",
    "furniture": "Furniture",
    "other": "Other",
}


def generate_asset_code(db: Session, category: str) -> str:
    prefix = CATEGORY_PREFIX.get(category, "OT")
    count = db.query(Asset).filter(Asset.category == category).count()
    return f"#{prefix}-{str(count + 1).zfill(4)}"


def asset_to_dict(asset, include_lifecycle=False):
    d = {
        "id": asset.id,
        "asset_code": asset.asset_code,
        "name": asset.name,
        "category": asset.category,
        "category_label": CATEGORY_LABELS.get(asset.category, asset.category),
        "serial_number": asset.serial_number,
        "purchase_date": str(asset.purchase_date) if asset.purchase_date else None,
        "purchase_cost": asset.purchase_cost,
        "vendor": asset.vendor,
        "warranty_expiry": str(asset.warranty_expiry) if asset.warranty_expiry else None,
        "status": asset.status,
        "current_employee_id": asset.current_employee_id,
        "current_employee": (
            f"{asset.current_employee.first_name} {asset.current_employee.last_name}"
            if asset.current_employee else None
        ),
        "current_employee_initials": (
            f"{asset.current_employee.first_name[0]}{asset.current_employee.last_name[0]}"
            if asset.current_employee else None
        ),
        "notes": asset.notes,
        "created_at": str(asset.created_at) if asset.created_at else None,
    }
    if include_lifecycle:
        d["lifecycle"] = [assignment_to_dict(a) for a in asset.assignments]
    return d


def assignment_to_dict(a):
    return {
        "id": a.id,
        "event_type": a.event_type,
        "event_date": str(a.event_date) if a.event_date else None,
        "employee_id": a.employee_id,
        "employee": (
            f"{a.employee.first_name} {a.employee.last_name}" if a.employee else None
        ),
        "employee_initials": (
            f"{a.employee.first_name[0]}{a.employee.last_name[0]}" if a.employee else None
        ),
        "notes": a.notes,
    }


class AssetCreate(BaseModel):
    name: str
    category: str
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_cost: Optional[float] = None
    vendor: Optional[str] = None
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    serial_number: Optional[str] = None
    vendor: Optional[str] = None
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = None


class AssignRequest(BaseModel):
    employee_id: int
    event_date: date
    notes: Optional[str] = None


class ReturnRequest(BaseModel):
    event_date: date
    notes: Optional[str] = None


class MaintenanceRequest(BaseModel):
    event_date: date
    notes: Optional[str] = None
    return_from_maintenance: bool = False


@router.get("/stats")
def get_asset_stats(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    total = db.query(Asset).count()
    assigned = db.query(Asset).filter(Asset.status == "assigned").count()
    available = db.query(Asset).filter(Asset.status == "available").count()
    maintenance = db.query(Asset).filter(Asset.status == "maintenance").count()
    retired = db.query(Asset).filter(Asset.status == "retired").count()
    return {
        "total": total,
        "assigned": assigned,
        "available": available,
        "maintenance": maintenance,
        "retired": retired,
    }


@router.get("/categories")
def get_category_summary(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    rows = db.query(Asset.category, func.count(Asset.id)).group_by(Asset.category).all()
    result = [{"category": r[0], "label": CATEGORY_LABELS.get(r[0], r[0]), "count": r[1]} for r in rows]
    result.sort(key=lambda x: x["count"], reverse=True)
    return result


@router.get("/assignments/recent")
def get_recent_assignments(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    assignments = (
        db.query(AssetAssignment)
        .order_by(AssetAssignment.event_date.desc())
        .limit(limit)
        .all()
    )
    result = []
    for a in assignments:
        result.append({
            "id": a.id,
            "asset_id": a.asset_id,
            "asset_code": a.asset.asset_code,
            "asset_name": a.asset.name,
            "asset_category": a.asset.category,
            "event_type": a.event_type,
            "event_date": str(a.event_date) if a.event_date else None,
            "employee": (
                f"{a.employee.first_name} {a.employee.last_name}" if a.employee else None
            ),
            "employee_initials": (
                f"{a.employee.first_name[0]}{a.employee.last_name[0]}" if a.employee else None
            ),
            "asset_status": a.asset.status,
            "notes": a.notes,
        })
    return result


@router.get("/")
def get_assets(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    query = db.query(Asset)
    if category:
        query = query.filter(Asset.category == category)
    if status:
        query = query.filter(Asset.status == status)
    if search:
        query = query.filter(
            Asset.name.ilike(f"%{search}%") | Asset.asset_code.ilike(f"%{search}%")
        )
    total = query.count()
    assets = query.offset(skip).limit(limit).all()
    return {"total": total, "assets": [asset_to_dict(a) for a in assets]}


@router.get("/employee-search")
def search_assets_by_employee(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if len(q.strip()) < 2:
        return []
    term = f"%{q.strip()}%"
    employees = (
        db.query(Employee)
        .filter(
            or_(
                Employee.first_name.ilike(term),
                Employee.last_name.ilike(term),
                func.concat(Employee.first_name, " ", Employee.last_name).ilike(term),
            )
        )
        .limit(20)
        .all()
    )
    result = []
    for emp in employees:
        assets = db.query(Asset).filter(Asset.current_employee_id == emp.id).all()
        result.append({
            "employee_id": emp.id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "employee_initials": f"{emp.first_name[0]}{emp.last_name[0]}",
            "title": emp.title,
            "department": emp.department.name if emp.department else None,
            "asset_count": len(assets),
            "assets": [asset_to_dict(a) for a in assets],
        })
    return result


@router.get("/warranty-expiring")
def get_warranty_expiring(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    threshold = date.today() + timedelta(days=days)
    assets = db.query(Asset).filter(
        Asset.warranty_expiry.isnot(None),
        Asset.warranty_expiry <= threshold,
        Asset.status != "retired"
    ).order_by(Asset.warranty_expiry).all()
    return [asset_to_dict(a) for a in assets]


@router.get("/{asset_id}")
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset_to_dict(asset, include_lifecycle=True)


@router.post("/")
def create_asset(
    data: AssetCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    asset = Asset(
        asset_code=generate_asset_code(db, data.category),
        name=data.name,
        category=data.category,
        serial_number=data.serial_number,
        purchase_date=data.purchase_date,
        purchase_cost=data.purchase_cost,
        vendor=data.vendor,
        warranty_expiry=data.warranty_expiry,
        status="available",
        notes=data.notes,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    event = AssetAssignment(
        asset_id=asset.id,
        event_type="purchased",
        event_date=data.purchase_date or date.today(),
        notes=f"Purchased from {data.vendor or 'vendor'} and added to inventory",
        performed_by=current_user.id,
    )
    db.add(event)
    db.commit()
    return asset_to_dict(asset)


@router.put("/{asset_id}")
def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset_to_dict(asset)


@router.post("/{asset_id}/assign")
def assign_asset(
    asset_id: int,
    data: AssignRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status == "assigned":
        raise HTTPException(status_code=400, detail="Asset is already assigned to someone")
    if asset.status == "retired":
        raise HTTPException(status_code=400, detail="Retired asset cannot be assigned")

    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    asset.status = "assigned"
    asset.current_employee_id = data.employee_id

    event = AssetAssignment(
        asset_id=asset.id,
        employee_id=data.employee_id,
        event_type="assigned",
        event_date=data.event_date,
        notes=data.notes,
        performed_by=current_user.id,
    )
    db.add(event)
    db.commit()
    create_notification(
        db, user_id=data.employee_id, type="asset_assigned",
        title="An asset has been assigned to you",
        body=f"{asset.name} ({asset.asset_code})",
        link="/assets",
    )
    db.commit()
    return asset_to_dict(asset)


@router.post("/{asset_id}/return")
def return_asset(
    asset_id: int,
    data: ReturnRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    prev_employee_id = asset.current_employee_id
    asset.status = "available"
    asset.current_employee_id = None

    event = AssetAssignment(
        asset_id=asset.id,
        employee_id=prev_employee_id,
        event_type="returned",
        event_date=data.event_date,
        notes=data.notes,
        performed_by=current_user.id,
    )
    db.add(event)
    db.commit()
    if prev_employee_id:
        create_notification(
            db, user_id=prev_employee_id, type="asset_returned",
            title="Your asset return has been recorded",
            body=f"{asset.name} ({asset.asset_code})",
            link="/assets",
        )
        db.commit()
    return asset_to_dict(asset)


@router.post("/{asset_id}/maintenance")
def maintenance_asset(
    asset_id: int,
    data: MaintenanceRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    prev_employee_id = asset.current_employee_id
    if data.return_from_maintenance:
        asset.status = "available"
        event_type = "maintenance_returned"
    else:
        asset.status = "maintenance"
        asset.current_employee_id = None

    event = AssetAssignment(
        asset_id=asset.id,
        employee_id=asset.current_employee_id if not data.return_from_maintenance else None,
        event_type=event_type if data.return_from_maintenance else "maintenance_sent",
        event_date=data.event_date,
        notes=data.notes,
        performed_by=current_user.id,
    )
    db.add(event)
    db.commit()
    if not data.return_from_maintenance and prev_employee_id:
        create_notification(
            db, user_id=prev_employee_id, type="asset_maintenance",
            title="Your asset has been sent for maintenance",
            body=f"{asset.name} ({asset.asset_code})",
            link="/assets",
        )
        db.commit()
    return asset_to_dict(asset)


@router.put("/{asset_id}/retire")
def retire_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    prev_employee_id = asset.current_employee_id
    asset.status = "retired"
    asset.current_employee_id = None

    event = AssetAssignment(
        asset_id=asset.id,
        event_type="retired",
        event_date=date.today(),
        notes="Asset retired / disposed",
        performed_by=current_user.id,
    )
    db.add(event)
    db.commit()
    if prev_employee_id:
        create_notification(
            db, user_id=prev_employee_id, type="asset_retired",
            title="Your assigned asset has been retired",
            body=f"{asset.name} ({asset.asset_code})",
            link="/assets",
        )
        db.commit()
    return asset_to_dict(asset)


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_admin),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status == "assigned":
        raise HTTPException(status_code=400, detail="Cannot delete an assigned asset — return it first")
    db.query(AssetAssignment).filter(AssetAssignment.asset_id == asset_id).delete()
    db.delete(asset)
    db.commit()
    return {"message": "Asset deleted successfully"}
