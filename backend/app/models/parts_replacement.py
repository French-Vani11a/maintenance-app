from datetime import datetime, date

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class PartsReplacement(Base):
    __tablename__ = "parts_replacements"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    part_name = Column(String(200), nullable=False)
    interval_days = Column(Integer, nullable=True)
    last_replacement_date = Column(Date, nullable=True)
    next_replacement_date = Column(Date, nullable=True)
    replacement_status = Column(String(30), nullable=False, default="Not Scheduled")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    equipment = relationship("Equipment", back_populates="parts_replacements")
