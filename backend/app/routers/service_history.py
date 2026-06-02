from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.service_history import ServiceHistory
from app.models.user import User
from app.schemas.service_history import ServiceHistory as ServiceHistorySchema, ServiceHistoryCreate, ServiceHistoryUpdate
from app.security import get_current_user
from app.services.audit_service import log_action

router = APIRouter()


@router.get("/")
def get_service_history(
    equipment_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(ServiceHistory)
        .filter(ServiceHistory.equipment_id == equipment_id)
        .order_by(ServiceHistory.service_date.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "equipment_id": r.equipment_id,
            "service_date": r.service_date,
            "service_type": r.service_type,
            "performed_by": r.performed_by,
            "notes": r.notes,
            "created_at": r.created_at,
        }
        for r in records
    ]


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
    return db_record


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
    return db_record


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
