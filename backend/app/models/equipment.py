from datetime import date

from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text
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
    last_service_date = Column(Date, nullable=True)
    service_interval_days = Column(Integer, nullable=True)
    next_service_date = Column(Date, nullable=True)
    service_type = Column(String(100), nullable=True)
    service_notes = Column(Text, nullable=True)
    service_status = Column(String(30), default="Not Scheduled", nullable=False)
    manufacturer = Column(String(200), nullable=True)
    model_number = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    plant = relationship("Plant", back_populates="equipment")
    equipment_group = relationship("EquipmentGroup", back_populates="equipment")
    maintenance_records = relationship("MaintenanceRecord", back_populates="equipment")
    service_histories = relationship("ServiceHistory", back_populates="equipment", cascade="all, delete-orphan")
    parts_replacements = relationship("PartsReplacement", back_populates="equipment", cascade="all, delete-orphan")
    components = relationship("EquipmentComponent", back_populates="equipment", cascade="all, delete-orphan")
