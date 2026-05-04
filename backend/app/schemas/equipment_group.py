from typing import Optional

from pydantic import BaseModel


class EquipmentGroupBase(BaseModel):
    name: str
    plant_id: Optional[int] = None


class EquipmentGroupCreate(EquipmentGroupBase):
    pass


class EquipmentGroupUpdate(BaseModel):
    name: Optional[str] = None
    plant_id: Optional[int] = None


class EquipmentGroup(EquipmentGroupBase):
    id: int
    plant_name: Optional[str] = None

    model_config = {"from_attributes": True}
