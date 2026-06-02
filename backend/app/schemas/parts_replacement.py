from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class PartsReplacementBase(BaseModel):
    equipment_id: int
    part_name: str
    interval_days: Optional[int] = None
    last_replacement_date: Optional[date] = None
    notes: Optional[str] = None


class PartsReplacementCreate(PartsReplacementBase):
    pass


class PartsReplacementUpdate(BaseModel):
    part_name: Optional[str] = None
    interval_days: Optional[int] = None
    last_replacement_date: Optional[date] = None
    notes: Optional[str] = None


class PartsReplacement(PartsReplacementBase):
    id: int
    next_replacement_date: Optional[date] = None
    replacement_status: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
