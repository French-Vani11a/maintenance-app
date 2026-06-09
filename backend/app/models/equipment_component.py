from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class EquipmentComponent(Base):
    __tablename__ = "equipment_components"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    component_name = Column(String(300), nullable=False, index=True)
    manufacturer = Column(String(200), nullable=True)
    model_number = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    last_service_date = Column(Date, nullable=True)
    service_interval_days = Column(Integer, nullable=True)
    next_service_date = Column(Date, nullable=True)
    service_status = Column(String(30), default="Not Scheduled", nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    equipment = relationship("Equipment", back_populates="components")
