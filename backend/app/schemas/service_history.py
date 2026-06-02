from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ServiceHistoryBase(BaseModel):
    equipment_id: int
    service_date: date
    service_type: Optional[str] = None
    performed_by: Optional[str] = None
    notes: Optional[str] = None
    work_done: Optional[str] = None
    parts_used: Optional[str] = None
    job_card_id: Optional[int] = None


class ServiceHistoryCreate(ServiceHistoryBase):
    pass


class ServiceHistoryUpdate(BaseModel):
    service_date: Optional[date] = None
    service_type: Optional[str] = None
    performed_by: Optional[str] = None
    notes: Optional[str] = None
    work_done: Optional[str] = None
    parts_used: Optional[str] = None


class ServiceHistory(ServiceHistoryBase):
    id: int
    created_at: Optional[datetime] = None
    equipment_name: Optional[str] = None
    plant_name: Optional[str] = None
    job_card_number: Optional[str] = None

    model_config = {"from_attributes": True}
