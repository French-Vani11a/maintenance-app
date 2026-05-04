from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class EquipmentGroup(Base):
    __tablename__ = "equipment_groups"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True, index=True)
    name = Column(String(200), nullable=False, index=True)

    plant = relationship("Plant")
    equipment = relationship("Equipment", back_populates="equipment_group")
