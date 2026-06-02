from datetime import datetime, date

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ServiceHistory(Base):
    __tablename__ = "service_history"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    service_date = Column(Date, nullable=False)
    service_type = Column(String(100), nullable=True)
    performed_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    work_done = Column(Text, nullable=True)
    parts_used = Column(Text, nullable=True)
    job_card_id = Column(Integer, ForeignKey("service_job_cards.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    equipment = relationship("Equipment", back_populates="service_histories")
    job_card = relationship("ServiceJobCard", foreign_keys=[job_card_id])
