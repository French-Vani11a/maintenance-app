from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    record_date = Column(DateTime, nullable=False, index=True)
    time_reported = Column(String(20), nullable=True)
    reporter_name = Column(String(200), nullable=True)
    reported_to = Column(String(200), nullable=True)
    artisan_name = Column(String(200), nullable=True, index=True)
    mr_no = Column(String(100), nullable=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True, index=True)
    equipment_group_id = Column(Integer, ForeignKey("equipment_groups.id"), nullable=True, index=True)
    issue_description = Column(Text, nullable=True)
    arrival_time = Column(String(20), nullable=True)
    finishing_time = Column(String(20), nullable=True)
    downtime_minutes = Column(Integer, nullable=True, default=0)
    run_time_minutes = Column(Float, nullable=True)
    is_slicer = Column(Boolean, nullable=False, default=False)
    prev_hr_meter = Column(Float, nullable=True)
    curr_hr_meter = Column(Float, nullable=True)
    remarks = Column(Text, nullable=True)
    status = Column(String(30), default="open", nullable=False, index=True)
    record_type = Column(String(20), default="regular", nullable=False, index=True)
    fault_category_id = Column(Integer, ForeignKey("fault_categories.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    plant = relationship("Plant", back_populates="maintenance_records")
    equipment = relationship("Equipment", back_populates="maintenance_records")
    equipment_group = relationship("EquipmentGroup")
    fault_category = relationship("FaultCategory", back_populates="maintenance_records")
    created_by_user = relationship("User", back_populates="created_records")
