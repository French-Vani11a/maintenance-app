from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ServiceJobCard(Base):
    __tablename__ = "service_job_cards"

    id = Column(Integer, primary_key=True, index=True)
    job_card_number = Column(String(30), unique=True, index=True, nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)
    service_type = Column(String(100), nullable=True)
    due_date = Column(Date, nullable=True)
    service_description = Column(Text, nullable=True)
    work_to_be_done = Column(Text, nullable=True)
    assigned_artisan = Column(String(150), nullable=True)
    assigned_by = Column(String(150), nullable=True)
    start_date = Column(Date, nullable=True)
    parts_required = Column(Text, nullable=True)
    priority = Column(String(20), default="medium", nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="open", nullable=False)
    completed_date = Column(Date, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    equipment = relationship("Equipment")
    plant = relationship("Plant")
    created_by = relationship("User")
