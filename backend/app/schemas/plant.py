from typing import Optional

from pydantic import BaseModel


class PlantBase(BaseModel):
    name: str


class PlantCreate(PlantBase):
    pass


class PlantUpdate(BaseModel):
    name: Optional[str] = None


class Plant(PlantBase):
    id: int

    model_config = {"from_attributes": True}
