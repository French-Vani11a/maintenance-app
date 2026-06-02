import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.maintenance_record import MaintenanceRecord
from app.models.user import User
from app.schemas.maintenance_record import (
    MaintenanceRecordCreate,
    MaintenanceRecordUpdate,
)
from app.security import get_current_user
from app.services.audit_service import log_action

router = APIRouter()


def _parse_time_to_minutes(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    try:
        parts = value.strip().split(":")
        if len(parts) != 2:
            return None
        hours = int(parts[0])
        minutes = int(parts[1])
        if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
            return None
        return hours * 60 + minutes
    except (ValueError, AttributeError):
        return None


def _compute_downtime_minutes(arrival_time: Optional[str], finishing_time: Optional[str]) -> Optional[int]:
    arrival = _parse_time_to_minutes(arrival_time)
    finishing = _parse_time_to_minutes(finishing_time)
    if arrival is None or finishing is None:
        return None
    if finishing >= arrival:
        return finishing - arrival
    return (24 * 60 - arrival) + finishing


def _enrich(record: MaintenanceRecord) -> dict:
    return {
        "id": record.id,
        "record_date": record.record_date,
        "time_reported": record.time_reported,
        "reporter_name": record.reporter_name,
        "reported_to": record.reported_to,
        "artisan_name": record.artisan_name,
        "mr_no": record.mr_no,
        "plant_id": record.plant_id,
        "equipment_id": record.equipment_id,
        "issue_description": record.issue_description,
        "arrival_time": record.arrival_time,
        "finishing_time": record.finishing_time,
        "downtime_minutes": record.downtime_minutes,
        "remarks": record.remarks,
        "status": record.status,
        "fault_category_id": record.fault_category_id,
        "created_by_user_id": record.created_by_user_id,
        "created_by_user_name": record.created_by_user.full_name if record.created_by_user else None,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "plant_name": record.plant.name if record.plant else None,
        "equipment_name": record.equipment.equipment_name if record.equipment else None,
        "equipment_group_id": record.equipment_group_id or (record.equipment.equipment_group_id if record.equipment else None),
        "equipment_group_name": (
            record.equipment_group.name if record.equipment_group else
            (record.equipment.equipment_group.name if record.equipment and record.equipment.equipment_group else None)
        ),
        "fault_category_name": record.fault_category.name if record.fault_category else None,
    }


def _build_query(
    db: Session,
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    plant_id: Optional[int],
    equipment_id: Optional[int],
    equipment_group_id: Optional[int],
    created_by: Optional[str],
    artisan_name: Optional[str],
    reporter_name: Optional[str],
    mr_no: Optional[str],
    status: Optional[str],
    search: Optional[str],
):
    query = db.query(MaintenanceRecord)
    if date_from:
        query = query.filter(MaintenanceRecord.record_date >= date_from)
    if date_to:
        query = query.filter(MaintenanceRecord.record_date <= date_to)
    if plant_id:
        query = query.filter(MaintenanceRecord.plant_id == plant_id)
    if equipment_id:
        query = query.filter(MaintenanceRecord.equipment_id == equipment_id)
    if equipment_group_id:
        query = query.filter(
            or_(
                MaintenanceRecord.equipment_group_id == equipment_group_id,
                MaintenanceRecord.equipment.has(equipment_group_id=equipment_group_id),
            )
        )
    if created_by:
        query = query.filter(MaintenanceRecord.created_by_user.has(User.full_name.ilike(f"%{created_by}%")))
    if artisan_name:
        query = query.filter(MaintenanceRecord.artisan_name.ilike(f"%{artisan_name}%"))
    if reporter_name:
        query = query.filter(MaintenanceRecord.reporter_name.ilike(f"%{reporter_name}%"))
    if mr_no:
        query = query.filter(MaintenanceRecord.mr_no.ilike(f"%{mr_no}%"))
    if status:
        query = query.filter(MaintenanceRecord.status == status)
    if search:
        query = query.filter(
            or_(
                MaintenanceRecord.issue_description.ilike(f"%{search}%"),
                MaintenanceRecord.mr_no.ilike(f"%{search}%"),
                MaintenanceRecord.artisan_name.ilike(f"%{search}%"),
                MaintenanceRecord.reporter_name.ilike(f"%{search}%"),
                MaintenanceRecord.remarks.ilike(f"%{search}%"),
                MaintenanceRecord.equipment.has(Equipment.equipment_name.ilike(f"%{search}%")),
            )
        )
    return query


@router.get("/")
def get_records(
    skip: int = 0,
    limit: int = 100,
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    plant_id: Optional[int] = Query(None),
    equipment_id: Optional[int] = Query(None),
    equipment_group_id: Optional[int] = Query(None),
    created_by: Optional[str] = Query(None),
    artisan_name: Optional[str] = Query(None),
    reporter_name: Optional[str] = Query(None),
    mr_no: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _build_query(
        db, date_from, date_to, plant_id, equipment_id, equipment_group_id, created_by,
        artisan_name, reporter_name, mr_no, status, search,
    )
    total = query.count()
    records = (
        query.order_by(MaintenanceRecord.record_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "records": [_enrich(r) for r in records]}


@router.get("/export/csv")
def export_csv(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    plant_id: Optional[int] = Query(None),
    equipment_id: Optional[int] = Query(None),
    equipment_group_id: Optional[int] = Query(None),
    created_by: Optional[str] = Query(None),
    artisan_name: Optional[str] = Query(None),
    mr_no: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _build_query(
        db, date_from, date_to, plant_id, equipment_id, equipment_group_id, created_by,
        artisan_name, None, mr_no, status, search,
    )
    records = query.order_by(MaintenanceRecord.record_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Date", "Time Reported", "Reporter", "Reported To", "Artisan",
        "MR No", "Plant", "Equipment", "Equipment Group", "Issue Description",
        "Arrival Time", "Finishing Time", "Downtime (mins)", "Status", "Remarks",
    ])
    for r in records:
        writer.writerow([
            r.id,
            r.record_date.strftime("%Y-%m-%d") if r.record_date else "",
            r.time_reported or "",
            r.reporter_name or "",
            r.reported_to or "",
            r.artisan_name or "",
            r.mr_no or "",
            r.plant.name if r.plant else "",
            r.equipment.equipment_name if r.equipment else "",
            r.equipment_group.name if r.equipment_group else (r.equipment.equipment_group.name if r.equipment and r.equipment.equipment_group else ""),
            r.issue_description or "",
            r.arrival_time or "",
            r.finishing_time or "",
            r.downtime_minutes or 0,
            r.status,
            r.remarks or "",
        ])

    output.seek(0)
    filename = f"maintenance_records_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/")
def create_record(
    record: MaintenanceRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = record.model_dump()
    payload["created_by_user_id"] = current_user.id
    if payload.get("equipment_group_id") is None and payload.get("equipment_id") is not None:
        equipment = db.query(Equipment).filter(Equipment.id == payload["equipment_id"]).first()
        if equipment and equipment.equipment_group_id is not None:
            payload["equipment_group_id"] = equipment.equipment_group_id

    if payload.get("downtime_minutes") is None:
        computed_downtime = _compute_downtime_minutes(payload.get("arrival_time"), payload.get("finishing_time"))
        if computed_downtime is not None:
            payload["downtime_minutes"] = computed_downtime

    if payload.get("downtime_minutes") is None:
        payload["downtime_minutes"] = 0

    db_record = MaintenanceRecord(**payload)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    log_action(db, current_user.id, "create", "maintenance_record", db_record.id, f"Created record {db_record.mr_no}")
    return _enrich(db_record)


@router.get("/{record_id}")
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return _enrich(record)


@router.put("/{record_id}")
def update_record(
    record_id: int,
    record_update: MaintenanceRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    update_data = record_update.model_dump(exclude_unset=True)
    downtime_explicitly_set = "downtime_minutes" in update_data and update_data["downtime_minutes"] is not None
    if not downtime_explicitly_set:
        arrival_time = update_data.get("arrival_time", record.arrival_time)
        finishing_time = update_data.get("finishing_time", record.finishing_time)
        computed_downtime = _compute_downtime_minutes(arrival_time, finishing_time)
        if computed_downtime is not None:
            update_data["downtime_minutes"] = computed_downtime

    if "equipment_id" in update_data and update_data.get("equipment_group_id") is None:
        equipment = db.query(Equipment).filter(Equipment.id == update_data["equipment_id"]).first()
        if equipment and equipment.equipment_group_id is not None:
            update_data["equipment_group_id"] = equipment.equipment_group_id

    if "equipment_group_id" not in update_data and record.equipment_id is not None:
        update_data["equipment_group_id"] = record.equipment_group_id or (
            record.equipment.equipment_group_id if record.equipment else None
        )

    for field, value in update_data.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    log_action(db, current_user.id, "update", "maintenance_record", record.id, f"Updated record {record.mr_no}")
    return _enrich(record)


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()
    log_action(db, current_user.id, "delete", "maintenance_record", record.id, f"Deleted record {record.mr_no}")
    return {"message": "Record deleted"}
