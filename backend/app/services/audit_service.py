from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.database import get_db

def log_action(db: Session, user_id: int, action: str, item_type: str, item_id: int = None, details: str = None):
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        item_type=item_type,
        item_id=item_id,
        details=details
    )
    db.add(log_entry)
    db.commit()