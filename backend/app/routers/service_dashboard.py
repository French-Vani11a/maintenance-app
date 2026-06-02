from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.plant import Plant
from app.models.service_history import ServiceHistory
from app.models.user import User
from app.security import get_current_user

router = APIRouter()


@router.get("/stats")
def get_service_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    soon_cutoff = today + timedelta(days=14)

    overdue_count = (
        db.query(Equipment)
        .filter(Equipment.next_service_date != None, Equipment.next_service_date < today)
        .count()
    )
    due_soon_count = (
        db.query(Equipment)
        .filter(Equipment.next_service_date != None, Equipment.next_service_date >= today, Equipment.next_service_date <= soon_cutoff)
        .count()
    )
    upcoming_count = (
        db.query(Equipment)
        .filter(Equipment.next_service_date != None, Equipment.next_service_date > soon_cutoff)
        .count()
    )
    not_scheduled_count = (
        db.query(Equipment)
        .filter(
            (Equipment.last_service_date == None)
            | (Equipment.service_interval_days == None)
            | (Equipment.next_service_date == None)
        )
        .count()
    )

    completed_this_month = (
        db.query(func.count(ServiceHistory.id))
        .filter(
            func.extract("month", ServiceHistory.service_date) == today.month,
            func.extract("year", ServiceHistory.service_date) == today.year,
        )
        .scalar()
        or 0
    )

    status_breakdown = (
        db.query(Equipment.service_status, func.count(Equipment.id).label("count"))
        .group_by(Equipment.service_status)
        .all()
    )

    overdue_by_plant = (
        db.query(
            Plant.id,
            Plant.name,
            func.count(Equipment.id).label("overdue_count"),
        )
        .join(Equipment, Plant.id == Equipment.plant_id)
        .filter(Equipment.next_service_date != None, Equipment.next_service_date < today)
        .group_by(Plant.id, Plant.name)
        .order_by(func.count(Equipment.id).desc())
        .all()
    )

    upcoming_services = (
        db.query(
            Equipment.id,
            Equipment.equipment_name,
            Plant.name.label("plant_name"),
            Equipment.next_service_date,
            Equipment.service_status,
        )
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(Equipment.next_service_date != None, Equipment.next_service_date >= today)
        .order_by(Equipment.next_service_date.asc())
        .limit(20)
        .all()
    )

    overdue_services = (
        db.query(
            Equipment.id,
            Equipment.equipment_name,
            Plant.name.label("plant_name"),
            Equipment.next_service_date,
            Equipment.service_status,
        )
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(Equipment.next_service_date != None, Equipment.next_service_date < today)
        .order_by(Equipment.next_service_date.asc())
        .limit(20)
        .all()
    )

    return {
        "overdue_count": overdue_count,
        "due_soon_count": due_soon_count,
        "upcoming_count": upcoming_count,
        "not_scheduled_count": not_scheduled_count,
        "completed_this_month": completed_this_month,
        "status_breakdown": [
            {"status": s.service_status or "Not Scheduled", "count": s.count}
            for s in status_breakdown
        ],
        "overdue_by_plant": [
            {"id": p.id, "name": p.name, "overdue_count": p.overdue_count}
            for p in overdue_by_plant
        ],
        "upcoming_services": [
            {
                "id": e.id,
                "equipment_name": e.equipment_name,
                "plant_name": e.plant_name,
                "next_service_date": e.next_service_date,
                "status": e.service_status,
            }
            for e in upcoming_services
        ],
        "overdue_services": [
            {
                "id": e.id,
                "equipment_name": e.equipment_name,
                "plant_name": e.plant_name,
                "next_service_date": e.next_service_date,
                "status": e.service_status,
            }
            for e in overdue_services
        ],
    }
