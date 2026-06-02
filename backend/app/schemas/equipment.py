from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class EquipmentBase(BaseModel):
    equipment_name: str
    equipment_code: Optional[str] = None
    plant_id: Optional[int] = None
    equipment_group_id: Optional[int] = None
    status: str = "active"
    last_service_date: Optional[date] = None
    service_interval_days: Optional[int] = None
    next_service_date: Optional[date] = None
    service_type: Optional[str] = None
    service_notes: Optional[str] = None
    service_status: Optional[str] = "Not Scheduled"
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    equipment_name: Optional[str] = None
    equipment_code: Optional[str] = None
    plant_id: Optional[int] = None
    equipment_group_id: Optional[int] = None
    status: Optional[str] = None
    last_service_date: Optional[date] = None
    service_interval_days: Optional[int] = None
    service_type: Optional[str] = None
    service_notes: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None


class Equipment(EquipmentBase):
    id: int
    plant_name: Optional[str] = None
    equipment_group_name: Optional[str] = None

    model_config = {"from_attributes": True}


class RecentServiceHistory(BaseModel):
    id: int
    service_date: str
    service_type: Optional[str] = None
    performed_by: Optional[str] = None
    notes: Optional[str] = None


class RecentMaintenanceRecord(BaseModel):
    id: int
    record_date: str
    mr_no: Optional[str] = None
    issue_description: Optional[str] = None
    status: str
    artisan_name: Optional[str] = None
    downtime_minutes: int
    reporter_name: Optional[str] = None


class EquipmentDetails(Equipment):
    recent_service_histories: List[RecentServiceHistory] = []
    recent_maintenance_records: List[RecentMaintenanceRecord] = []
