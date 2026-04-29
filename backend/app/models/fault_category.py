from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class FaultCategory(Base):
    __tablename__ = "fault_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False)

    maintenance_records = relationship("MaintenanceRecord", back_populates="fault_category")
