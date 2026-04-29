from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MaintenanceRecordBase(BaseModel):
    record_date: datetime
    time_reported: Optional[str] = None
    reporter_name: Optional[str] = None
    reported_to: Optional[str] = None
    artisan_name: Optional[str] = None
    mr_no: Optional[str] = None
    plant_id: Optional[int] = None
    equipment_id: Optional[int] = None
    issue_description: Optional[str] = None
    arrival_time: Optional[str] = None
    finishing_time: Optional[str] = None
    downtime_minutes: Optional[int] = None
    remarks: Optional[str] = None
    status: str = "open"
    fault_category_id: Optional[int] = None


class MaintenanceRecordCreate(MaintenanceRecordBase):
    pass


class MaintenanceRecordUpdate(BaseModel):
    record_date: Optional[datetime] = None
    time_reported: Optional[str] = None
    reporter_name: Optional[str] = None
    reported_to: Optional[str] = None
    artisan_name: Optional[str] = None
    mr_no: Optional[str] = None
    plant_id: Optional[int] = None
    equipment_id: Optional[int] = None
    issue_description: Optional[str] = None
    arrival_time: Optional[str] = None
    finishing_time: Optional[str] = None
    downtime_minutes: Optional[int] = None
    remarks: Optional[str] = None
    status: Optional[str] = None
    fault_category_id: Optional[int] = None


class MaintenanceRecord(MaintenanceRecordBase):
    id: int
    created_by_user_id: Optional[int] = None
    created_by_user_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    plant_name: Optional[str] = None
    equipment_name: Optional[str] = None
    fault_category_name: Optional[str] = None

    model_config = {"from_attributes": True}
