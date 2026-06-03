from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.service_history import ServiceHistory
from app.models.service_job_card import ServiceJobCard
from app.models.user import User
from app.schemas.service_job_card import (
    ServiceJobCardCreate,
    ServiceJobCardUpdate,
    ServiceJobCardComplete,
)
from app.routers.equipment import _derive_service_status
from app.security import get_current_user
from app.services.audit_service import log_action

router = APIRouter()


def _enrich(jc: ServiceJobCard) -> dict:
    return {
        "id": jc.id,
        "job_card_number": jc.job_card_number,
        "equipment_id": jc.equipment_id,
        "equipment_name": jc.equipment.equipment_name if jc.equipment else None,
        "equipment_code": jc.equipment.equipment_code if jc.equipment else None,
        "plant_id": jc.plant_id,
        "plant_name": jc.plant.name if jc.plant else None,
        "service_type": jc.service_type,
        "due_date": jc.due_date,
        "service_description": jc.service_description,
        "work_to_be_done": jc.work_to_be_done,
        "assigned_artisan": jc.assigned_artisan,
        "assigned_by": jc.assigned_by,
        "start_date": jc.start_date,
        "parts_required": jc.parts_required,
        "priority": jc.priority,
        "notes": jc.notes,
        "status": jc.status,
        "completed_date": jc.completed_date,
        "created_by_user_id": jc.created_by_user_id,
        "created_by_user_name": jc.created_by.full_name if jc.created_by else None,
        "created_at": jc.created_at,
    }


def _generate_job_card_number(db: Session) -> str:
    today = date.today()
    prefix = f"JC-{today.strftime('%Y%m%d')}-"
    count = (
        db.query(ServiceJobCard)
        .filter(ServiceJobCard.job_card_number.like(f"{prefix}%"))
        .count()
    )
    return f"{prefix}{count + 1:04d}"


def _update_equipment_after_service(db: Session, equipment_id: int, service_date: date) -> None:
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        return
    eq.last_service_date = service_date
    if eq.service_interval_days:
        next_date = service_date + timedelta(days=eq.service_interval_days)
        eq.next_service_date = next_date
        today = date.today()
        if next_date < today:
            eq.service_status = "Overdue"
        elif next_date == today:
            eq.service_status = "Due Today"
        elif next_date <= today + timedelta(days=14):
            eq.service_status = "Due Soon"
        else:
            eq.service_status = "On Schedule"


@router.get("/due-equipment")
def get_due_equipment(
    search: Optional[str] = Query(None),
    plant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    cutoff = today + timedelta(days=7)
    query = db.query(Equipment)

    if plant_id:
        query = query.filter(Equipment.plant_id == plant_id)
    if search:
        query = query.filter(Equipment.equipment_name.ilike(f"%{search}%"))

    query = query.filter(
        or_(
            Equipment.next_service_date < today,
            (Equipment.next_service_date >= today) & (Equipment.next_service_date <= cutoff),
        )
    ).order_by(Equipment.next_service_date.asc())

    items = query.all()
    return [
        {
            "id": eq.id,
            "equipment_name": eq.equipment_name,
            "equipment_code": eq.equipment_code,
            "plant_id": eq.plant_id,
            "plant_name": eq.plant.name if eq.plant else None,
            "service_type": eq.service_type,
            "last_service_date": eq.last_service_date,
            "next_service_date": eq.next_service_date,
            "service_status": _derive_service_status(eq.last_service_date, eq.service_interval_days, eq.next_service_date),
            "service_interval_days": eq.service_interval_days,
            "manufacturer": eq.manufacturer,
            "model_number": eq.model_number,
        }
        for eq in items
    ]


@router.get("/search-equipment")
def search_all_equipment(
    search: str = Query(...),
    plant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Equipment).filter(Equipment.equipment_name.ilike(f"%{search}%"))
    if plant_id:
        query = query.filter(Equipment.plant_id == plant_id)
    items = query.order_by(Equipment.equipment_name).limit(20).all()
    return [
        {
            "id": eq.id,
            "equipment_name": eq.equipment_name,
            "equipment_code": eq.equipment_code,
            "plant_id": eq.plant_id,
            "plant_name": eq.plant.name if eq.plant else None,
            "service_type": eq.service_type,
            "last_service_date": eq.last_service_date,
            "next_service_date": eq.next_service_date,
            "service_status": _derive_service_status(eq.last_service_date, eq.service_interval_days, eq.next_service_date),
            "service_interval_days": eq.service_interval_days,
            "manufacturer": eq.manufacturer,
            "model_number": eq.model_number,
        }
        for eq in items
    ]


@router.get("/")
def get_job_cards(
    status: Optional[str] = Query(None),
    plant_id: Optional[int] = Query(None),
    equipment_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ServiceJobCard)
    if status:
        query = query.filter(ServiceJobCard.status == status)
    if plant_id:
        query = query.filter(ServiceJobCard.plant_id == plant_id)
    if equipment_id:
        query = query.filter(ServiceJobCard.equipment_id == equipment_id)
    if priority:
        query = query.filter(ServiceJobCard.priority == priority)
    if search:
        query = query.join(Equipment, ServiceJobCard.equipment_id == Equipment.id).filter(
            or_(
                Equipment.equipment_name.ilike(f"%{search}%"),
                ServiceJobCard.job_card_number.ilike(f"%{search}%"),
                ServiceJobCard.assigned_artisan.ilike(f"%{search}%"),
            )
        )
    total = query.count()
    items = query.order_by(ServiceJobCard.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "job_cards": [_enrich(jc) for jc in items]}


@router.post("/")
def create_job_card(
    data: ServiceJobCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    if not payload.get("plant_id"):
        eq = db.query(Equipment).filter(Equipment.id == payload["equipment_id"]).first()
        if eq:
            payload["plant_id"] = eq.plant_id

    payload["job_card_number"] = _generate_job_card_number(db)
    payload["created_by_user_id"] = current_user.id

    jc = ServiceJobCard(**payload)
    db.add(jc)
    db.commit()
    db.refresh(jc)
    log_action(
        db, current_user.id, "create", "service_job_card", jc.id,
        f"Created job card {jc.job_card_number} for equipment {jc.equipment_id}",
    )
    return _enrich(jc)


@router.put("/{job_card_id}")
def update_job_card(
    job_card_id: int,
    data: ServiceJobCardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jc = db.query(ServiceJobCard).filter(ServiceJobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(jc, field, value)
    db.commit()
    db.refresh(jc)
    log_action(db, current_user.id, "update", "service_job_card", jc.id, f"Updated job card {jc.job_card_number}")
    return _enrich(jc)


@router.post("/{job_card_id}/complete")
def complete_job_card(
    job_card_id: int,
    data: ServiceJobCardComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jc = db.query(ServiceJobCard).filter(ServiceJobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    if jc.status == "completed":
        raise HTTPException(status_code=400, detail="Job card is already completed")

    history = ServiceHistory(
        equipment_id=jc.equipment_id,
        service_date=data.service_date,
        service_type=jc.service_type,
        performed_by=data.performed_by,
        notes=data.completion_notes,
        work_done=data.work_done,
        parts_used=data.parts_used,
        job_card_id=jc.id,
    )
    db.add(history)
    db.flush()

    jc.status = "completed"
    jc.completed_date = data.service_date

    _update_equipment_after_service(db, jc.equipment_id, data.service_date)

    db.commit()
    db.refresh(jc)

    log_action(
        db, current_user.id, "update", "service_job_card", jc.id,
        f"Completed job card {jc.job_card_number}",
    )
    log_action(
        db, current_user.id, "create", "service_history", history.id,
        f"Service completed for equipment {jc.equipment_id} via job card {jc.job_card_number}",
    )
    return _enrich(jc)


@router.delete("/{job_card_id}")
def delete_job_card(
    job_card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jc = db.query(ServiceJobCard).filter(ServiceJobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    jcn = jc.job_card_number
    db.delete(jc)
    db.commit()
    log_action(db, current_user.id, "delete", "service_job_card", job_card_id, f"Deleted job card {jcn}")
    return {"message": "Job card deleted"}
