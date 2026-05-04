from typing import Optional

from pydantic import BaseModel


class EquipmentBase(BaseModel):
    equipment_name: str
    equipment_code: Optional[str] = None
    plant_id: Optional[int] = None
    equipment_group_id: Optional[int] = None
    status: str = "active"


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    equipment_name: Optional[str] = None
    equipment_code: Optional[str] = None
    plant_id: Optional[int] = None
    equipment_group_id: Optional[int] = None
    status: Optional[str] = None


class Equipment(EquipmentBase):
    id: int
    plant_name: Optional[str] = None
    equipment_group_name: Optional[str] = None

    model_config = {"from_attributes": True}
