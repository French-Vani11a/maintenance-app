from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.equipment_group import EquipmentGroup
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


def _enrich(eq: Equipment) -> dict:
    return {
        "id": eq.id,
        "equipment_name": eq.equipment_name,
        "equipment_code": eq.equipment_code,
        "plant_id": eq.plant_id,
        "equipment_group_id": eq.equipment_group_id,
        "status": eq.status,
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
    db_eq = Equipment(**eq.model_dump())
    db.add(db_eq)
    db.commit()
    db.refresh(db_eq)
    log_action(db, current_user.id, "create", "equipment", db_eq.id, f"Created equipment {db_eq.equipment_name}")
    return _enrich(db_eq)


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
    for field, value in eq_update.model_dump(exclude_unset=True).items():
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
