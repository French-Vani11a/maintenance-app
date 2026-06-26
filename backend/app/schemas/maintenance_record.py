from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

VALID_RECORD_TYPES = {"regular", "breakdown"}


class MaintenanceRecordBase(BaseModel):
    record_date: datetime
    time_reported: Optional[str] = None
    reporter_name: Optional[str] = None
    reported_to: Optional[str] = None
    artisan_name: Optional[str] = None
    mr_no: Optional[str] = None
    plant_id: Optional[int] = None
    equipment_id: Optional[int] = None
    equipment_group_id: Optional[int] = None
    issue_description: Optional[str] = None
    arrival_time: Optional[str] = None
    finishing_time: Optional[str] = None
    downtime_minutes: Optional[int] = None
    run_time_minutes: Optional[float] = None
    is_slicer: bool = False
    prev_hr_meter: Optional[float] = None
    curr_hr_meter: Optional[float] = None
    remarks: Optional[str] = None
    status: str = "open"
    record_type: str = "regular"
    fault_category_id: Optional[int] = None

    @field_validator("record_type")
    @classmethod
    def validate_record_type(cls, v: str) -> str:
        normalised = v.strip().lower()
        if normalised not in VALID_RECORD_TYPES:
            raise ValueError(f"record_type must be one of: {', '.join(sorted(VALID_RECORD_TYPES))}")
        return normalised


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
    equipment_group_id: Optional[int] = None
    issue_description: Optional[str] = None
    arrival_time: Optional[str] = None
    finishing_time: Optional[str] = None
    downtime_minutes: Optional[int] = None
    run_time_minutes: Optional[float] = None
    is_slicer: Optional[bool] = None
    prev_hr_meter: Optional[float] = None
    curr_hr_meter: Optional[float] = None
    remarks: Optional[str] = None
    status: Optional[str] = None
    record_type: Optional[str] = None
    fault_category_id: Optional[int] = None

    @field_validator("record_type")
    @classmethod
    def validate_record_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        normalised = v.strip().lower()
        if normalised not in VALID_RECORD_TYPES:
            raise ValueError(f"record_type must be one of: {', '.join(sorted(VALID_RECORD_TYPES))}")
        return normalised


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
