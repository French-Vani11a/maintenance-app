import os
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.equipment import Equipment
from app.models.equipment_group import EquipmentGroup
from app.models.maintenance_record import MaintenanceRecord
from app.models.plant import Plant
from app.models.user import User
from app.security import get_current_user
from app.services.excel_importer import get_sheet_names, parse_excel_equipment, parse_excel_maintenance_records

router = APIRouter()


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are accepted")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        sheets = get_sheet_names(tmp_path)
        selected_sheet = sheet_name or sheets[0]
        records = parse_excel_maintenance_records(tmp_path, sheet_name=selected_sheet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        os.unlink(tmp_path)

    return {
        "sheets": sheets,
        "selected_sheet": selected_sheet,
        "total_records": len(records),
        "preview": records[:20],
    }


@router.post("/commit")
async def commit_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are accepted")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        sheets = get_sheet_names(tmp_path)
        selected_sheet = sheet_name or sheets[0]
        records = parse_excel_maintenance_records(tmp_path, sheet_name=selected_sheet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        os.unlink(tmp_path)

    saved = 0
    created = 0
    updated = 0
    errors = []

    for i, row in enumerate(records):
        try:
            plant_name = row.pop("plant", None)
            equipment_name = row.pop("equipment", None)

            plant_id = None
            if plant_name:
                plant = db.query(Plant).filter(Plant.name.ilike(plant_name)).first()
                if not plant:
                    plant = Plant(name=plant_name.strip().title())
                    db.add(plant)
                    db.flush()
                plant_id = plant.id

            equipment_id = None
            if equipment_name:
                equip = db.query(Equipment).filter(
                    Equipment.equipment_name.ilike(equipment_name)
                ).first()
                if not equip:
                    equip = Equipment(
                        equipment_name=equipment_name.strip(),
                        plant_id=plant_id,
                    )
                    db.add(equip)
                    db.flush()
                equipment_id = equip.id

            existing_record = None
            incoming_mr_no = row.get("mr_no")

            if incoming_mr_no:
                existing_record = (
                    db.query(MaintenanceRecord)
                    .filter(MaintenanceRecord.mr_no.ilike(str(incoming_mr_no).strip()))
                    .first()
                )

            if not existing_record:
                existing_record = (
                    db.query(MaintenanceRecord)
                    .filter(
                        MaintenanceRecord.record_date == row.get("record_date"),
                        MaintenanceRecord.plant_id == plant_id,
                        MaintenanceRecord.equipment_id == equipment_id,
                        MaintenanceRecord.issue_description == row.get("issue_description"),
                    )
                    .first()
                )

            if existing_record:
                existing_record.plant_id = plant_id
                existing_record.equipment_id = equipment_id
                existing_record.created_by_user_id = current_user.id
                for field, value in row.items():
                    setattr(existing_record, field, value)
                updated += 1
            else:
                db_record = MaintenanceRecord(
                    plant_id=plant_id,
                    equipment_id=equipment_id,
                    created_by_user_id=current_user.id,
                    **row,
                )
                db.add(db_record)
                created += 1

            saved += 1
        except Exception as exc:
            errors.append({"row": i + 1, "error": str(exc)})

    db.commit()
    return {
        "saved": saved,
        "created": created,
        "updated": updated,
        "errors": errors,
        "message": f"Successfully imported {saved} records ({created} created, {updated} updated)",
    }


@router.post("/equipment/preview")
async def preview_equipment_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are accepted")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        sheets = get_sheet_names(tmp_path)
        selected_sheet = sheet_name or sheets[0]
        equipment = parse_excel_equipment(tmp_path, sheet_name=selected_sheet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        os.unlink(tmp_path)

    return {
        "sheets": sheets,
        "selected_sheet": selected_sheet,
        "total_records": len(equipment),
        "preview": equipment[:20],
    }


@router.post("/equipment/commit")
async def commit_equipment_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are accepted")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        sheets = get_sheet_names(tmp_path)
        selected_sheet = sheet_name or sheets[0]
        equipment_list = parse_excel_equipment(tmp_path, sheet_name=selected_sheet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        os.unlink(tmp_path)

    saved = 0
    created = 0
    updated = 0
    errors = []

    for i, row in enumerate(equipment_list):
        try:
            # Handle plant
            plant_id = None
            if "plant" in row:
                plant_name = row["plant"]
                plant = db.query(Plant).filter(Plant.name.ilike(plant_name)).first()
                if not plant:
                    plant = Plant(name=plant_name.strip().title())
                    db.add(plant)
                    db.flush()
                plant_id = plant.id

            # Handle equipment group
            equipment_group_id = None
            if "equipment_group" in row:
                group_name = row["equipment_group"]
                group = db.query(EquipmentGroup).filter(EquipmentGroup.name.ilike(group_name)).first()
                if not group:
                    group = EquipmentGroup(name=group_name.strip(), plant_id=plant_id)
                    db.add(group)
                    db.flush()
                equipment_group_id = group.id

            # Check if equipment already exists
            existing_equipment = db.query(Equipment).filter(
                Equipment.equipment_name.ilike(row["equipment_name"])
            ).first()

            equipment_data = {
                "equipment_name": row["equipment_name"],
                "equipment_code": row.get("equipment_code"),
                "plant_id": plant_id,
                "equipment_group_id": equipment_group_id,
                "status": row.get("status", "active"),
            }

            if existing_equipment:
                # Update existing equipment
                for field, value in equipment_data.items():
                    setattr(existing_equipment, field, value)
                updated += 1
            else:
                # Create new equipment
                db_equipment = Equipment(**equipment_data)
                db.add(db_equipment)
                created += 1

            saved += 1
        except Exception as exc:
            errors.append({"row": i + 1, "error": str(exc)})

    db.commit()
    return {
        "saved": saved,
        "created": created,
        "updated": updated,
        "errors": errors,
        "message": f"Successfully imported {saved} equipment ({created} created, {updated} updated)",
    }
