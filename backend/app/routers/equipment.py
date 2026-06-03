from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.equipment_group import EquipmentGroup
from app.models.maintenance_record import MaintenanceRecord
from app.models.user import User
from app.schemas.equipment import Equipment as EquipmentSchema, EquipmentCreate, EquipmentUpdate
from app.schemas.equipment_group import (
    EquipmentGroup as EquipmentGroupSchema,
    EquipmentGroupCreate,
    EquipmentGroupUpdate,
)
from app.security import get_current_user
from app.services.audit_service import log_action

router = APIRouter()


def _calculate_next_service_date(last_service_date: Optional[date], service_interval_days: Optional[int]) -> Optional[date]:
    if last_service_date and service_interval_days:
        return last_service_date + timedelta(days=service_interval_days)
    return None


def _derive_service_status(last_service_date: Optional[date], service_interval_days: Optional[int], next_service_date: Optional[date]) -> str:
    if not last_service_date or not service_interval_days or not next_service_date:
        return "Not Scheduled"
    today = date.today()
    if next_service_date < today:
        return "Overdue"
    if next_service_date == today:
        return "Due Today"
    if next_service_date <= today + timedelta(days=14):
        return "Due Soon"
    return "On Schedule"


def _prepare_service_fields(data: dict, existing: Optional[Equipment] = None) -> dict:
    last_service_date = data.get("last_service_date")
    service_interval_days = data.get("service_interval_days")

    if existing is not None:
        last_service_date = last_service_date if "last_service_date" in data else existing.last_service_date
        service_interval_days = service_interval_days if "service_interval_days" in data else existing.service_interval_days

    next_service_date = _calculate_next_service_date(last_service_date, service_interval_days)
    data["next_service_date"] = next_service_date
    data["service_status"] = _derive_service_status(last_service_date, service_interval_days, next_service_date)
    return data


def _enrich(eq: Equipment) -> dict:
    return {
        "id": eq.id,
        "equipment_name": eq.equipment_name,
        "equipment_code": eq.equipment_code,
        "plant_id": eq.plant_id,
        "equipment_group_id": eq.equipment_group_id,
        "status": eq.status,
        "last_service_date": eq.last_service_date,
        "service_interval_days": eq.service_interval_days,
        "next_service_date": eq.next_service_date,
        "service_type": eq.service_type,
        "service_notes": eq.service_notes,
        "service_status": _derive_service_status(eq.last_service_date, eq.service_interval_days, eq.next_service_date),
        "manufacturer": eq.manufacturer,
        "model_number": eq.model_number,
        "description": eq.description,
        "plant_name": eq.plant.name if eq.plant else None,
        "equipment_group_name": eq.equipment_group.name if eq.equipment_group else None,
    }


@router.get("/")
def get_equipment(
    skip: int = 0,
    limit: int = 100,
    plant_id: Optional[int] = Query(None),
    equipment_group_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Equipment)
    if plant_id:
        query = query.filter(Equipment.plant_id == plant_id)
    if equipment_group_id:
        query = query.filter(Equipment.equipment_group_id == equipment_group_id)
    if status:
        query = query.filter(Equipment.status == status)
    if search:
        query = query.filter(Equipment.equipment_name.ilike(f"%{search}%"))
    total = query.count()
    items = (
        query.order_by(Equipment.equipment_name)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "equipment": [_enrich(e) for e in items]}


@router.post("/")
def create_equipment(
    eq: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = _prepare_service_fields(eq.model_dump())
    db_eq = Equipment(**data)
    db.add(db_eq)
    db.commit()
    db.refresh(db_eq)
    log_action(db, current_user.id, "create", "equipment", db_eq.id, f"Created equipment {db_eq.equipment_name}")
    return _enrich(db_eq)


@router.get("/{equipment_id}/details")
def get_equipment_details(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not db_eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    recent_service = sorted(db_eq.service_histories, key=lambda x: x.service_date, reverse=True)[:5]
    recent_maintenance = (
        db.query(MaintenanceRecord)
        .filter(MaintenanceRecord.equipment_id == equipment_id)
        .order_by(MaintenanceRecord.record_date.desc())
        .limit(5)
        .all()
    )

    return {
        **_enrich(db_eq),
        "recent_service_histories": [
            {
                "id": s.id,
                "service_date": str(s.service_date),
                "service_type": s.service_type,
                "performed_by": s.performed_by,
                "notes": s.notes,
            }
            for s in recent_service
        ],
        "recent_maintenance_records": [
            {
                "id": r.id,
                "record_date": str(r.record_date),
                "mr_no": r.mr_no,
                "issue_description": r.issue_description,
                "status": r.status,
                "artisan_name": r.artisan_name,
                "downtime_minutes": r.downtime_minutes,
                "reporter_name": r.reporter_name,
            }
            for r in recent_maintenance
        ],
    }


@router.put("/{equipment_id}")
def update_equipment(
    equipment_id: int,
    eq_update: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not db_eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    update_data = eq_update.model_dump(exclude_unset=True)
    update_data = _prepare_service_fields(update_data, existing=db_eq)
    for field, value in update_data.items():
        setattr(db_eq, field, value)
    db.commit()
    db.refresh(db_eq)
    log_action(db, current_user.id, "update", "equipment", db_eq.id, f"Updated equipment {db_eq.equipment_name}")
    return _enrich(db_eq)


@router.delete("/{equipment_id}")
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not db_eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(db_eq)
    db.commit()
    log_action(db, current_user.id, "delete", "equipment", db_eq.id, f"Deleted equipment {db_eq.equipment_name}")
    return {"message": "Equipment deleted"}


@router.get("/groups/")
def get_equipment_groups(
    plant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(EquipmentGroup)
    if plant_id:
        query = query.filter(EquipmentGroup.plant_id == plant_id)
    groups = query.order_by(EquipmentGroup.name).all()
    return [
        {
            "id": g.id,
            "name": g.name,
            "plant_id": g.plant_id,
            "plant_name": g.plant.name if g.plant else None,
        }
        for g in groups
    ]


@router.post("/groups/")
def create_equipment_group(
    group: EquipmentGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_group = EquipmentGroup(**group.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    log_action(db, current_user.id, "create", "equipment_group", db_group.id, f"Created equipment group {db_group.name}")
    return {
        "id": db_group.id,
        "name": db_group.name,
        "plant_id": db_group.plant_id,
        "plant_name": db_group.plant.name if db_group.plant else None,
    }


@router.put("/groups/{group_id}")
def update_equipment_group(
    group_id: int,
    group_update: EquipmentGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_group = db.query(EquipmentGroup).filter(EquipmentGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Equipment group not found")
    for field, value in group_update.model_dump(exclude_unset=True).items():
        setattr(db_group, field, value)
    db.commit()
    db.refresh(db_group)
    log_action(db, current_user.id, "update", "equipment_group", db_group.id, f"Updated equipment group {db_group.name}")
    return {
        "id": db_group.id,
        "name": db_group.name,
        "plant_id": db_group.plant_id,
        "plant_name": db_group.plant.name if db_group.plant else None,
    }


@router.delete("/groups/{group_id}")
def delete_equipment_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_group = db.query(EquipmentGroup).filter(EquipmentGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Equipment group not found")
    db.delete(db_group)
    db.commit()
    log_action(db, current_user.id, "delete", "equipment_group", db_group.id, f"Deleted equipment group {db_group.name}")
    return {"message": "Equipment group deleted"}
