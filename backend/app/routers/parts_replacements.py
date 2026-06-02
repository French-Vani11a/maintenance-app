from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.parts_replacement import PartsReplacement
from app.models.user import User
from app.schemas.parts_replacement import (
    PartsReplacement as PartsReplacementSchema,
    PartsReplacementCreate,
    PartsReplacementUpdate,
)
from app.security import get_current_user
from app.services.audit_service import log_action

router = APIRouter()


def _calculate_next_replacement_date(last_replacement_date: date | None, interval_days: int | None) -> date | None:
    if last_replacement_date and interval_days:
        return last_replacement_date + timedelta(days=interval_days)
    return None


def _derive_replacement_status(last_replacement_date: date | None, interval_days: int | None, next_replacement_date: date | None) -> str:
    if not last_replacement_date or not interval_days or not next_replacement_date:
        return "Not Scheduled"
    today = date.today()
    if next_replacement_date < today:
        return "Overdue"
    if next_replacement_date <= today + timedelta(days=14):
        return "Due Soon"
    return "On Schedule"


@router.get("/")
def get_parts_replacements(
    equipment_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    replacements = (
        db.query(PartsReplacement)
        .filter(PartsReplacement.equipment_id == equipment_id)
        .order_by(PartsReplacement.next_replacement_date.asc().nulls_last())
        .all()
    )
    return [
        {
            "id": r.id,
            "equipment_id": r.equipment_id,
            "part_name": r.part_name,
            "interval_days": r.interval_days,
            "last_replacement_date": r.last_replacement_date,
            "next_replacement_date": r.next_replacement_date,
            "replacement_status": r.replacement_status,
            "notes": r.notes,
            "created_at": r.created_at,
        }
        for r in replacements
    ]


@router.post("/")
def create_parts_replacement(
    replacement: PartsReplacementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = replacement.model_dump()
    next_date = _calculate_next_replacement_date(
        data.get("last_replacement_date"),
        data.get("interval_days"),
    )
    data["next_replacement_date"] = next_date
    data["replacement_status"] = _derive_replacement_status(
        data.get("last_replacement_date"),
        data.get("interval_days"),
        next_date,
    )
    db_replacement = PartsReplacement(**data)
    db.add(db_replacement)
    db.commit()
    db.refresh(db_replacement)
    log_action(db, current_user.id, "create", "parts_replacement", db_replacement.id, f"Created parts replacement schedule for equipment {db_replacement.equipment_id}")
    return db_replacement


@router.put("/{replacement_id}")
def update_parts_replacement(
    replacement_id: int,
    replacement_update: PartsReplacementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_replacement = db.query(PartsReplacement).filter(PartsReplacement.id == replacement_id).first()
    if not db_replacement:
        raise HTTPException(status_code=404, detail="Parts replacement record not found")
    for field, value in replacement_update.model_dump(exclude_unset=True).items():
        setattr(db_replacement, field, value)
    db_replacement.next_replacement_date = _calculate_next_replacement_date(
        db_replacement.last_replacement_date,
        db_replacement.interval_days,
    )
    db_replacement.replacement_status = _derive_replacement_status(
        db_replacement.last_replacement_date,
        db_replacement.interval_days,
        db_replacement.next_replacement_date,
    )
    db.commit()
    db.refresh(db_replacement)
    log_action(db, current_user.id, "update", "parts_replacement", db_replacement.id, f"Updated parts replacement record {db_replacement.id}")
    return db_replacement


@router.delete("/{replacement_id}")
def delete_parts_replacement(
    replacement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_replacement = db.query(PartsReplacement).filter(PartsReplacement.id == replacement_id).first()
    if not db_replacement:
        raise HTTPException(status_code=404, detail="Parts replacement record not found")
    db.delete(db_replacement)
    db.commit()
    log_action(db, current_user.id, "delete", "parts_replacement", db_replacement.id, f"Deleted parts replacement record {replacement_id}")
    return {"message": "Parts replacement record deleted"}
