from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.plant import Plant
from app.models.service_history import ServiceHistory
from app.models.service_job_card import ServiceJobCard
from app.models.user import User
from app.schemas.service_history import ServiceHistory as ServiceHistorySchema, ServiceHistoryCreate, ServiceHistoryUpdate
from app.security import get_current_user
from app.services.audit_service import log_action

router = APIRouter()


def _enrich_history(r: ServiceHistory) -> dict:
    return {
        "id": r.id,
        "equipment_id": r.equipment_id,
        "equipment_name": r.equipment.equipment_name if r.equipment else None,
        "equipment_code": r.equipment.equipment_code if r.equipment else None,
        "plant_id": r.equipment.plant_id if r.equipment else None,
        "plant_name": r.equipment.plant.name if r.equipment and r.equipment.plant else None,
        "service_date": r.service_date,
        "service_type": r.service_type,
        "performed_by": r.performed_by,
        "notes": r.notes,
        "work_done": r.work_done,
        "parts_used": r.parts_used,
        "job_card_id": r.job_card_id,
        "job_card_number": r.job_card.job_card_number if r.job_card else None,
        "created_at": r.created_at,
    }


@router.get("/")
def get_service_history(
    equipment_id: Optional[int] = Query(None),
    plant_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    artisan: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ServiceHistory)

    if equipment_id:
        query = query.filter(ServiceHistory.equipment_id == equipment_id)
    if plant_id:
        query = query.join(Equipment, ServiceHistory.equipment_id == Equipment.id).filter(
            Equipment.plant_id == plant_id
        )
    if date_from:
        query = query.filter(ServiceHistory.service_date >= date_from)
    if date_to:
        query = query.filter(ServiceHistory.service_date <= date_to)
    if artisan:
        query = query.filter(ServiceHistory.performed_by.ilike(f"%{artisan}%"))
    if service_type:
        query = query.filter(ServiceHistory.service_type.ilike(f"%{service_type}%"))
    if search:
        query = query.join(Equipment, ServiceHistory.equipment_id == Equipment.id, isouter=True).filter(
            Equipment.equipment_name.ilike(f"%{search}%")
        )

    total = query.count()
    records = (
        query.order_by(ServiceHistory.service_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "records": [_enrich_history(r) for r in records]}


@router.post("/")
def create_service_history(
    record: ServiceHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_record = ServiceHistory(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    log_action(db, current_user.id, "create", "service_history", db_record.id, f"Created service history for equipment {db_record.equipment_id}")
    return _enrich_history(db_record)


@router.put("/{record_id}")
def update_service_history(
    record_id: int,
    record_update: ServiceHistoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_record = db.query(ServiceHistory).filter(ServiceHistory.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="Service history record not found")
    for field, value in record_update.model_dump(exclude_unset=True).items():
        setattr(db_record, field, value)
    db.commit()
    db.refresh(db_record)
    log_action(db, current_user.id, "update", "service_history", db_record.id, f"Updated service history record {db_record.id}")
    return _enrich_history(db_record)


@router.delete("/{record_id}")
def delete_service_history(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_record = db.query(ServiceHistory).filter(ServiceHistory.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="Service history record not found")
    db.delete(db_record)
    db.commit()
    log_action(db, current_user.id, "delete", "service_history", db_record.id, f"Deleted service history record {record_id}")
    return {"message": "Service history record deleted"}
