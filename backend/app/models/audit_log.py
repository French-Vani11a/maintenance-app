from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # create, update, delete, import
    item_type = Column(String(50), nullable=False)  # equipment, maintenance_record, plant, equipment_group, user
    item_id = Column(Integer, nullable=True)  # ID of the item affected
    details = Column(Text, nullable=True)  # Additional details like old/new values
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship to user
    user = relationship("User", backref="audit_logs")