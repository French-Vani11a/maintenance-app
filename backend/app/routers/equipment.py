from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.user import User
from app.schemas.equipment import Equipment as EquipmentSchema, EquipmentCreate, EquipmentUpdate
from app.security import get_current_user

router = APIRouter()


def _enrich(eq: Equipment) -> dict:
    return {
        "id": eq.id,
        "equipment_name": eq.equipment_name,
        "equipment_code": eq.equipment_code,
        "plant_id": eq.plant_id,
        "status": eq.status,
        "plant_name": eq.plant.name if eq.plant else None,
    }


@router.get("/")
def get_equipment(
    plant_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Equipment)
    if plant_id:
        query = query.filter(Equipment.plant_id == plant_id)
    if status:
        query = query.filter(Equipment.status == status)
    if search:
        query = query.filter(Equipment.equipment_name.ilike(f"%{search}%"))
    items = query.order_by(Equipment.equipment_name).all()
    return [_enrich(e) for e in items]


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
    return {"message": "Equipment deleted"}
