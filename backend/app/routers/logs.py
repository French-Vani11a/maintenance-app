from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.security import get_current_user

router = APIRouter()


@router.get("/")
def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only admins can view audit logs
    if current_user.role != "admin":
        return []

    query = db.query(AuditLog).join(User)

    if date_from:
        query = query.filter(AuditLog.timestamp >= date_from)
    if date_to:
        query = query.filter(AuditLog.timestamp <= date_to)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if item_type:
        query = query.filter(AuditLog.item_type == item_type)

    total = query.count()
    logs = (
        query.order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_name": log.user.full_name,
                "action": log.action,
                "item_type": log.item_type,
                "item_id": log.item_id,
                "details": log.details,
                "timestamp": log.timestamp,
            }
            for log in logs
        ],
    }