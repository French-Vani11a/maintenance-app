from datetime import date as date_type
from datetime import datetime, time
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.maintenance_record import MaintenanceRecord
from app.models.plant import Plant
from app.models.user import User
from app.security import get_current_user

router = APIRouter()


def build_period_filters(
    date_from: Optional[date_type],
    date_to: Optional[date_type],
    month: Optional[int],
    year: Optional[int],
):
    now = datetime.now()
    month = month or now.month
    year = year or now.year

    period_filters = []
    if date_from or date_to:
        if date_from:
            period_filters.append(MaintenanceRecord.record_date >= datetime.combine(date_from, time.min))
        if date_to:
            period_filters.append(MaintenanceRecord.record_date <= datetime.combine(date_to, time.max))
    else:
        period_filters.extend([
            extract("month", MaintenanceRecord.record_date) == month,
            extract("year", MaintenanceRecord.record_date) == year,
        ])

    return period_filters


@router.get("/stats")
def get_dashboard_stats(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    date_from: Optional[date_type] = Query(None),
    date_to: Optional[date_type] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()
    month = month or now.month
    year = year or now.year

    period_filters = []
    if date_from or date_to:
        if date_from:
            period_filters.append(MaintenanceRecord.record_date >= datetime.combine(date_from, time.min))
        if date_to:
            period_filters.append(MaintenanceRecord.record_date <= datetime.combine(date_to, time.max))
    else:
        period_filters.extend([
            extract("month", MaintenanceRecord.record_date) == month,
            extract("year", MaintenanceRecord.record_date) == year,
        ])

    base = (
        db.query(MaintenanceRecord)
        .filter(*period_filters)
    )

    total_faults = base.count()
    open_faults = base.filter(MaintenanceRecord.status == "open").count()
    in_progress = base.filter(MaintenanceRecord.status == "in-progress").count()
    closed_faults = base.filter(MaintenanceRecord.status == "closed").count()

    total_downtime = (
        db.query(func.sum(MaintenanceRecord.downtime_minutes))
        .filter(*period_filters)
        .scalar()
        or 0
    )

    avg_repair_time = (
        db.query(func.avg(MaintenanceRecord.downtime_minutes))
        .filter(*period_filters, MaintenanceRecord.downtime_minutes > 0)
        .scalar()
        or 0
    )

    # Top 10 equipment by fault count
    top_equipment = (
        db.query(
            Equipment.equipment_name,
            func.count(MaintenanceRecord.id).label("fault_count"),
            func.sum(MaintenanceRecord.downtime_minutes).label("total_downtime"),
        )
        .join(MaintenanceRecord, Equipment.id == MaintenanceRecord.equipment_id)
        .filter(*period_filters)
        .group_by(Equipment.equipment_name)
        .order_by(func.count(MaintenanceRecord.id).desc())
        .limit(10)
        .all()
    )

    # Downtime by plant
    downtime_by_plant = (
        db.query(
            Plant.id,
            Plant.name,
            func.sum(MaintenanceRecord.downtime_minutes).label("total_downtime"),
            func.count(MaintenanceRecord.id).label("fault_count"),
        )
        .join(MaintenanceRecord, Plant.id == MaintenanceRecord.plant_id)
        .filter(*period_filters)
        .group_by(Plant.id, Plant.name)
        .order_by(func.sum(MaintenanceRecord.downtime_minutes).desc())
        .all()
    )

    # Faults by day (trend)
    faults_by_day = (
        db.query(
            func.date(MaintenanceRecord.record_date).label("date"),
            func.count(MaintenanceRecord.id).label("count"),
            func.sum(MaintenanceRecord.downtime_minutes).label("downtime"),
        )
        .filter(*period_filters)
        .group_by(func.date(MaintenanceRecord.record_date))
        .order_by(func.date(MaintenanceRecord.record_date))
        .all()
    )

    # Top artisans by job count
    top_artisans = (
        db.query(
            MaintenanceRecord.artisan_name,
            func.count(MaintenanceRecord.id).label("job_count"),
            func.sum(MaintenanceRecord.downtime_minutes).label("total_downtime"),
        )
        .filter(*period_filters, MaintenanceRecord.artisan_name.isnot(None))
        .group_by(MaintenanceRecord.artisan_name)
        .order_by(func.count(MaintenanceRecord.id).desc())
        .limit(10)
        .all()
    )

    return {
        "month": month,
        "year": year,
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None,
        "total_faults": total_faults,
        "open_faults": open_faults,
        "in_progress_faults": in_progress,
        "closed_faults": closed_faults,
        "total_downtime_minutes": total_downtime,
        "avg_repair_time_minutes": round(float(avg_repair_time), 1),
        "top_equipment": [
            {
                "name": e.equipment_name,
                "fault_count": e.fault_count,
                "total_downtime": e.total_downtime or 0,
            }
            for e in top_equipment
        ],
        "downtime_by_plant": [
            {
                "id": p.id,
                "name": p.name,
                "total_downtime": p.total_downtime or 0,
                "fault_count": p.fault_count,
            }
            for p in downtime_by_plant
        ],
        "faults_by_day": [
            {"date": str(d.date), "count": d.count, "downtime": d.downtime or 0}
            for d in faults_by_day
        ],
        "top_artisans": [
            {
                "name": a.artisan_name,
                "job_count": a.job_count,
                "total_downtime": a.total_downtime or 0,
            }
            for a in top_artisans
        ],
    }


@router.get("/equipment-downtime")
def get_equipment_downtime_for_plant(
    plant_id: int = Query(...),
    date_from: Optional[date_type] = Query(None),
    date_to: Optional[date_type] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period_filters = build_period_filters(date_from, date_to, None, None)

    equipment_downtime = (
        db.query(
            Equipment.equipment_name,
            func.sum(MaintenanceRecord.downtime_minutes).label("total_downtime"),
            func.count(MaintenanceRecord.id).label("fault_count"),
        )
        .join(MaintenanceRecord, Equipment.id == MaintenanceRecord.equipment_id)
        .filter(*period_filters, MaintenanceRecord.plant_id == plant_id)
        .group_by(Equipment.equipment_name)
        .order_by(func.sum(MaintenanceRecord.downtime_minutes).desc())
        .limit(10)
        .all()
    )

    return [
        {
            "name": e.equipment_name,
            "total_downtime": e.total_downtime or 0,
            "fault_count": e.fault_count,
        }
        for e in equipment_downtime
    ]
