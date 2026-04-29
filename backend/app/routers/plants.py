from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.plant import Plant
from app.models.user import User
from app.schemas.plant import Plant as PlantSchema, PlantCreate, PlantUpdate
from app.security import get_current_user

router = APIRouter()


@router.get("/", response_model=List[PlantSchema])
def get_plants(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Plant).order_by(Plant.name).all()


@router.post("/", response_model=PlantSchema)
def create_plant(
    plant: PlantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Plant).filter(Plant.name == plant.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plant with this name already exists")
    db_plant = Plant(name=plant.name)
    db.add(db_plant)
    db.commit()
    db.refresh(db_plant)
    return db_plant


@router.put("/{plant_id}", response_model=PlantSchema)
def update_plant(
    plant_id: int,
    plant_update: PlantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    if plant_update.name is not None:
        db_plant.name = plant_update.name
    db.commit()
    db.refresh(db_plant)
    return db_plant


@router.delete("/{plant_id}")
def delete_plant(
    plant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    db.delete(db_plant)
    db.commit()
    return {"message": "Plant deleted"}
