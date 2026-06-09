from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class EquipmentComponentBase(BaseModel):
    equipment_id: int
    component_name: str
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None
    last_service_date: Optional[date] = None
    service_interval_days: Optional[int] = None
    notes: Optional[str] = None
    status: str = "active"


class EquipmentComponentCreate(EquipmentComponentBase):
    pass


class EquipmentComponentUpdate(BaseModel):
    component_name: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None
    last_service_date: Optional[date] = None
    service_interval_days: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class EquipmentComponent(EquipmentComponentBase):
    id: int
    next_service_date: Optional[date] = None
    service_status: str
    equipment_name: Optional[str] = None
    plant_id: Optional[int] = None
    plant_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
