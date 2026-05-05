from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    action: str
    item_type: str
    item_id: int | None
    details: str | None
    timestamp: datetime

    class Config:
        from_attributes = True