from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.equipment_component import EquipmentComponent
from app.models.user import User
from app.schemas.equipment_component import (
    EquipmentComponentCreate,
    EquipmentComponentUpdate,
)
from app.security import get_current_user
from app.services.audit_service import log_action

router = APIRouter()


def _calculate_next_service_date(last_service_date, service_interval_days):
    if last_service_date and service_interval_days:
        return last_service_date + timedelta(days=service_interval_days)
    return None


def _derive_service_status(last_service_date, service_interval_days, next_service_date) -> str:
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


def _prepare_service_fields(data: dict, existing: Optional[EquipmentComponent] = None) -> dict:
    last_service_date = data.get("last_service_date")
    service_interval_days = data.get("service_interval_days")
    if existing is not None:
        if "last_service_date" not in data:
            last_service_date = existing.last_service_date
        if "service_interval_days" not in data:
            service_interval_days = existing.service_interval_days
    next_service_date = _calculate_next_service_date(last_service_date, service_interval_days)
    data["next_service_date"] = next_service_date
    data["service_status"] = _derive_service_status(last_service_date, service_interval_days, next_service_date)
    return data


def _enrich(c: EquipmentComponent) -> dict:
    return {
        "id": c.id,
        "equipment_id": c.equipment_id,
        "equipment_name": c.equipment.equipment_name if c.equipment else None,
        "plant_id": c.equipment.plant_id if c.equipment else None,
        "plant_name": c.equipment.plant.name if c.equipment and c.equipment.plant else None,
        "component_name": c.component_name,
        "manufacturer": c.manufacturer,
        "model_number": c.model_number,
        "description": c.description,
        "last_service_date": c.last_service_date,
        "service_interval_days": c.service_interval_days,
        "next_service_date": c.next_service_date,
        "service_status": _derive_service_status(c.last_service_date, c.service_interval_days, c.next_service_date),
        "notes": c.notes,
        "status": c.status,
        "created_at": c.created_at,
    }


@router.get("/")
def get_components(
    equipment_id: Optional[int] = Query(None),
    plant_id: Optional[int] = Query(None),
    service_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(EquipmentComponent).join(Equipment, EquipmentComponent.equipment_id == Equipment.id)
    if equipment_id:
        query = query.filter(EquipmentComponent.equipment_id == equipment_id)
    if plant_id:
        query = query.filter(Equipment.plant_id == plant_id)
    if service_status:
        query = query.filter(EquipmentComponent.service_status == service_status)
    if search:
        query = query.filter(
            or_(
                EquipmentComponent.component_name.ilike(f"%{search}%"),
                Equipment.equipment_name.ilike(f"%{search}%"),
            )
        )
    total = query.count()
    items = query.order_by(EquipmentComponent.component_name).offset(skip).limit(limit).all()
    return {"total": total, "components": [_enrich(c) for c in items]}


@router.get("/due")
def get_due_components(
    search: Optional[str] = Query(None),
    plant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    cutoff = today + timedelta(days=7)
    query = (
        db.query(EquipmentComponent)
        .join(Equipment, EquipmentComponent.equipment_id == Equipment.id)
        .filter(
            or_(
                EquipmentComponent.next_service_date < today,
                (EquipmentComponent.next_service_date >= today)
                & (EquipmentComponent.next_service_date <= cutoff),
            )
        )
    )
    if plant_id:
        query = query.filter(Equipment.plant_id == plant_id)
    if search:
        query = query.filter(
            or_(
                EquipmentComponent.component_name.ilike(f"%{search}%"),
                Equipment.equipment_name.ilike(f"%{search}%"),
            )
        )
    items = query.order_by(EquipmentComponent.next_service_date.asc()).all()
    return [_enrich(c) for c in items]


@router.post("/")
def create_component(
    data: EquipmentComponentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    eq = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    payload = _prepare_service_fields(data.model_dump())
    component = EquipmentComponent(**payload)
    db.add(component)
    db.commit()
    db.refresh(component)
    log_action(db, current_user.id, "create", "equipment_component", component.id,
               f"Created component '{component.component_name}' for equipment {eq.equipment_name}")
    return _enrich(component)


@router.put("/{component_id}")
def update_component(
    component_id: int,
    data: EquipmentComponentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    component = db.query(EquipmentComponent).filter(EquipmentComponent.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    update_data = data.model_dump(exclude_unset=True)
    update_data = _prepare_service_fields(update_data, existing=component)
    for field, value in update_data.items():
        setattr(component, field, value)
    db.commit()
    db.refresh(component)
    log_action(db, current_user.id, "update", "equipment_component", component.id,
               f"Updated component '{component.component_name}'")
    return _enrich(component)


@router.delete("/{component_id}")
def delete_component(
    component_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    component = db.query(EquipmentComponent).filter(EquipmentComponent.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    name = component.component_name
    db.delete(component)
    db.commit()
    log_action(db, current_user.id, "delete", "equipment_component", component_id,
               f"Deleted component '{name}'")
    return {"message": "Component deleted"}
