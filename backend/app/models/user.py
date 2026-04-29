from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), nullable=False)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(300), nullable=False)
    role = Column(String(50), default="technician", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_records = relationship("MaintenanceRecord", back_populates="created_by_user")
