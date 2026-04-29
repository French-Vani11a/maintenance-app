from typing import Optional

from pydantic import BaseModel


class FaultCategoryBase(BaseModel):
    name: str


class FaultCategoryCreate(FaultCategoryBase):
    pass


class FaultCategory(FaultCategoryBase):
    id: int

    model_config = {"from_attributes": True}
