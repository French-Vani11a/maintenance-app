from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)
    equipment_group_id = Column(Integer, ForeignKey("equipment_groups.id"), nullable=True, index=True)
    equipment_name = Column(String(300), nullable=False, index=True)
    equipment_code = Column(String(100), nullable=True, index=True)
    status = Column(String(20), default="active", nullable=False)

    plant = relationship("Plant", back_populates="equipment")
    equipment_group = relationship("EquipmentGroup", back_populates="equipment")
    maintenance_records = relationship("MaintenanceRecord", back_populates="equipment")
