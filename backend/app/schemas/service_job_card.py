from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ServiceJobCardBase(BaseModel):
    equipment_id: int
    plant_id: Optional[int] = None
    service_type: Optional[str] = None
    due_date: Optional[date] = None
    service_description: Optional[str] = None
    work_to_be_done: Optional[str] = None
    assigned_artisan: Optional[str] = None
    assigned_by: Optional[str] = None
    start_date: Optional[date] = None
    parts_required: Optional[str] = None
    priority: str = "medium"
    notes: Optional[str] = None


class ServiceJobCardCreate(ServiceJobCardBase):
    pass


class ServiceJobCardUpdate(BaseModel):
    service_type: Optional[str] = None
    due_date: Optional[date] = None
    service_description: Optional[str] = None
    work_to_be_done: Optional[str] = None
    assigned_artisan: Optional[str] = None
    assigned_by: Optional[str] = None
    start_date: Optional[date] = None
    parts_required: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class ServiceJobCardComplete(BaseModel):
    service_date: date
    performed_by: Optional[str] = None
    work_done: Optional[str] = None
    parts_used: Optional[str] = None
    completion_notes: Optional[str] = None


class ServiceJobCard(ServiceJobCardBase):
    id: int
    job_card_number: str
    status: str
    completed_date: Optional[date] = None
    created_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    equipment_name: Optional[str] = None
    equipment_code: Optional[str] = None
    plant_name: Optional[str] = None
    created_by_user_name: Optional[str] = None

    model_config = {"from_attributes": True}
