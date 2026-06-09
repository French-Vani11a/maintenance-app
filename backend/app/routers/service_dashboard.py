from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.equipment_component import EquipmentComponent
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
    due_today_count = (
        db.query(Equipment)
        .filter(Equipment.next_service_date == today)
        .count()
    )
    due_soon_count = (
        db.query(Equipment)
        .filter(
            Equipment.next_service_date != None,
            Equipment.next_service_date >= today,
            Equipment.next_service_date <= soon_cutoff,
        )
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

    equipment_status_breakdown = (
        db.query(Equipment.service_status, func.count(Equipment.id).label("count"))
        .group_by(Equipment.service_status)
        .all()
    )
    component_status_breakdown = (
        db.query(EquipmentComponent.service_status, func.count(EquipmentComponent.id).label("count"))
        .group_by(EquipmentComponent.service_status)
        .all()
    )
    status_map: dict[str, int] = {}
    for s in equipment_status_breakdown:
        key = s.service_status or "Not Scheduled"
        status_map[key] = status_map.get(key, 0) + s.count
    for s in component_status_breakdown:
        key = s.service_status or "Not Scheduled"
        status_map[key] = status_map.get(key, 0) + s.count

    overdue_equipment_by_plant = (
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
    overdue_components_by_plant = (
        db.query(
            Plant.id,
            Plant.name,
            func.count(EquipmentComponent.id).label("overdue_count"),
        )
        .join(Equipment, Plant.id == Equipment.plant_id)
        .join(EquipmentComponent, Equipment.id == EquipmentComponent.equipment_id)
        .filter(EquipmentComponent.next_service_date != None, EquipmentComponent.next_service_date < today)
        .group_by(Plant.id, Plant.name)
        .all()
    )
    overdue_by_plant_map: dict[int, dict] = {}
    for p in overdue_equipment_by_plant:
        overdue_by_plant_map[p.id] = {"id": p.id, "name": p.name, "overdue_count": p.overdue_count}
    for p in overdue_components_by_plant:
        if p.id not in overdue_by_plant_map:
            overdue_by_plant_map[p.id] = {"id": p.id, "name": p.name, "overdue_count": 0}
        overdue_by_plant_map[p.id]["overdue_count"] += p.overdue_count

    due_today_services = (
        db.query(
            Equipment.id,
            Equipment.equipment_name,
            Plant.name.label("plant_name"),
            Equipment.next_service_date,
        )
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(Equipment.next_service_date == today)
        .order_by(Equipment.equipment_name.asc())
        .limit(20)
        .all()
    )

    upcoming_services = (
        db.query(
            Equipment.id,
            Equipment.equipment_name,
            Plant.name.label("plant_name"),
            Equipment.next_service_date,
        )
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(
            Equipment.next_service_date != None,
            Equipment.next_service_date >= today,
            Equipment.next_service_date <= soon_cutoff,
        )
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
        )
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(Equipment.next_service_date != None, Equipment.next_service_date < today)
        .order_by(Equipment.next_service_date.asc())
        .limit(20)
        .all()
    )

    upcoming_component_count = (
        db.query(EquipmentComponent)
        .filter(EquipmentComponent.next_service_date != None, EquipmentComponent.next_service_date > soon_cutoff)
        .count()
    )
    not_scheduled_component_count = (
        db.query(EquipmentComponent)
        .filter(
            (EquipmentComponent.last_service_date == None)
            | (EquipmentComponent.service_interval_days == None)
            | (EquipmentComponent.next_service_date == None)
        )
        .count()
    )

    # ── Component stats ──────────────────────────────────────────────────────
    overdue_component_count = (
        db.query(EquipmentComponent)
        .filter(EquipmentComponent.next_service_date != None, EquipmentComponent.next_service_date < today)
        .count()
    )
    due_today_component_count = (
        db.query(EquipmentComponent)
        .filter(EquipmentComponent.next_service_date == today)
        .count()
    )
    due_soon_component_count = (
        db.query(EquipmentComponent)
        .filter(
            EquipmentComponent.next_service_date != None,
            EquipmentComponent.next_service_date >= today,
            EquipmentComponent.next_service_date <= soon_cutoff,
        )
        .count()
    )

    overdue_component_services = (
        db.query(
            EquipmentComponent.id,
            EquipmentComponent.equipment_id,
            EquipmentComponent.component_name,
            Equipment.equipment_name,
            Plant.name.label("plant_name"),
            EquipmentComponent.next_service_date,
        )
        .join(Equipment, EquipmentComponent.equipment_id == Equipment.id)
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(EquipmentComponent.next_service_date != None, EquipmentComponent.next_service_date < today)
        .order_by(EquipmentComponent.next_service_date.asc())
        .limit(20)
        .all()
    )

    due_today_component_services = (
        db.query(
            EquipmentComponent.id,
            EquipmentComponent.equipment_id,
            EquipmentComponent.component_name,
            Equipment.equipment_name,
            Plant.name.label("plant_name"),
            EquipmentComponent.next_service_date,
        )
        .join(Equipment, EquipmentComponent.equipment_id == Equipment.id)
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(EquipmentComponent.next_service_date == today)
        .order_by(EquipmentComponent.component_name.asc())
        .limit(20)
        .all()
    )

    upcoming_component_services = (
        db.query(
            EquipmentComponent.id,
            EquipmentComponent.equipment_id,
            EquipmentComponent.component_name,
            Equipment.equipment_name,
            Plant.name.label("plant_name"),
            EquipmentComponent.next_service_date,
        )
        .join(Equipment, EquipmentComponent.equipment_id == Equipment.id)
        .outerjoin(Plant, Equipment.plant_id == Plant.id)
        .filter(
            EquipmentComponent.next_service_date != None,
            EquipmentComponent.next_service_date >= today,
            EquipmentComponent.next_service_date <= soon_cutoff,
        )
        .order_by(EquipmentComponent.next_service_date.asc())
        .limit(20)
        .all()
    )

    return {
        "overdue_count": overdue_count,
        "due_today_count": due_today_count,
        "due_soon_count": due_soon_count,
        "upcoming_count": upcoming_count,
        "not_scheduled_count": not_scheduled_count,
        "completed_this_month": completed_this_month,
        "overdue_component_count": overdue_component_count,
        "due_today_component_count": due_today_component_count,
        "due_soon_component_count": due_soon_component_count,
        "upcoming_component_count": upcoming_component_count,
        "not_scheduled_component_count": not_scheduled_component_count,
        "status_breakdown": [
            {"status": status, "count": count}
            for status, count in sorted(status_map.items())
        ],
        "overdue_by_plant": sorted(
            overdue_by_plant_map.values(),
            key=lambda p: p["overdue_count"],
            reverse=True,
        ),
        "due_today_services": [
            {
                "id": e.id,
                "equipment_name": e.equipment_name,
                "plant_name": e.plant_name,
                "next_service_date": e.next_service_date,
                "status": "Due Today",
                "item_type": "equipment",
            }
            for e in due_today_services
        ],
        "upcoming_services": [
            {
                "id": e.id,
                "equipment_name": e.equipment_name,
                "plant_name": e.plant_name,
                "next_service_date": e.next_service_date,
                "status": "Due Soon",
                "item_type": "equipment",
            }
            for e in upcoming_services
        ],
        "overdue_services": [
            {
                "id": e.id,
                "equipment_name": e.equipment_name,
                "plant_name": e.plant_name,
                "next_service_date": e.next_service_date,
                "status": "Overdue",
                "item_type": "equipment",
            }
            for e in overdue_services
        ],
        "overdue_component_services": [
            {
                "id": c.id,
                "equipment_id": c.equipment_id,
                "component_name": c.component_name,
                "equipment_name": c.equipment_name,
                "plant_name": c.plant_name,
                "next_service_date": c.next_service_date,
                "status": "Overdue",
                "item_type": "component",
            }
            for c in overdue_component_services
        ],
        "due_today_component_services": [
            {
                "id": c.id,
                "equipment_id": c.equipment_id,
                "component_name": c.component_name,
                "equipment_name": c.equipment_name,
                "plant_name": c.plant_name,
                "next_service_date": c.next_service_date,
                "status": "Due Today",
                "item_type": "component",
            }
            for c in due_today_component_services
        ],
        "upcoming_component_services": [
            {
                "id": c.id,
                "equipment_id": c.equipment_id,
                "component_name": c.component_name,
                "equipment_name": c.equipment_name,
                "plant_name": c.plant_name,
                "next_service_date": c.next_service_date,
                "status": "Due Soon",
                "item_type": "component",
            }
            for c in upcoming_component_services
        ],
    }
