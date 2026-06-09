import atexit

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import (
    auth,
    plants,
    equipment,
    equipment_components,
    users,
    maintenance_records,
    import_excel,
    dashboard,
    service_dashboard,
    service_history,
    service_job_cards,
    parts_replacements,
    logs,
)


def create_tables():
    Base.metadata.create_all(bind=engine)


def ensure_schema_updates():
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "equipment" in tables:
        equipment_columns = {c["name"] for c in inspector.get_columns("equipment")}
        if "equipment_group_id" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN equipment_group_id INTEGER REFERENCES equipment_groups(id)"))
        if "last_service_date" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN last_service_date DATE"))
        if "service_interval_days" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN service_interval_days INTEGER"))
        if "next_service_date" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN next_service_date DATE"))
        if "service_type" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN service_type VARCHAR(100)"))
        if "service_notes" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN service_notes TEXT"))
        if "service_status" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN service_status VARCHAR(30) DEFAULT 'Not Scheduled' NOT NULL"))
        if "manufacturer" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN manufacturer VARCHAR(200)"))
        if "model_number" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN model_number VARCHAR(100)"))
        if "description" not in equipment_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment ADD COLUMN description TEXT"))

    if "service_history" in tables:
        sh_columns = {c["name"] for c in inspector.get_columns("service_history")}
        if "work_done" not in sh_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE service_history ADD COLUMN work_done TEXT"))
        if "parts_used" not in sh_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE service_history ADD COLUMN parts_used TEXT"))
        if "job_card_id" not in sh_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE service_history ADD COLUMN job_card_id INTEGER REFERENCES service_job_cards(id)"))

    if "service_job_cards" in tables:
        jc_columns = {c["name"] for c in inspector.get_columns("service_job_cards")}
        if "assigned_by" not in jc_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE service_job_cards ADD COLUMN assigned_by VARCHAR(150)"))
        if "start_date" not in jc_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE service_job_cards ADD COLUMN start_date DATE"))

    if "equipment_components" in tables:
        ec_columns = {c["name"] for c in inspector.get_columns("equipment_components")}
        if "updated_at" not in ec_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE equipment_components ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL"))

    if "service_job_cards" in tables:
        jc_extra_columns = {c["name"] for c in inspector.get_columns("service_job_cards")}
        if "component_id" not in jc_extra_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE service_job_cards ADD COLUMN component_id INTEGER REFERENCES equipment_components(id)"))

    if "maintenance_records" not in tables:
        return

    columns = {c["name"] for c in inspector.get_columns("maintenance_records")}
    if "created_by_user_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE maintenance_records ADD COLUMN created_by_user_id INTEGER REFERENCES users(id)"))
    if "equipment_group_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE maintenance_records ADD COLUMN equipment_group_id INTEGER REFERENCES equipment_groups(id)"))
    if "record_type" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE maintenance_records ADD COLUMN record_type VARCHAR(20) NOT NULL DEFAULT 'regular'"))


def seed_default_admin():
    from app.models.user import User
    from app.security import get_password_hash

    if not settings.SEED_DEFAULT_ADMIN:
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == settings.DEFAULT_ADMIN_USERNAME).first()
        if not existing:
            admin = User(
                full_name="Administrator",
                username=settings.DEFAULT_ADMIN_USERNAME,
                hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


def recalculate_service_statuses():
    from datetime import date, timedelta
    from app.models.equipment import Equipment as EquipmentModel
    from app.models.equipment_component import EquipmentComponent as ComponentModel
    db = SessionLocal()
    try:
        today = date.today()
        for eq in db.query(EquipmentModel).all():
            if not eq.last_service_date or not eq.service_interval_days or not eq.next_service_date:
                new_status = "Not Scheduled"
            elif eq.next_service_date < today:
                new_status = "Overdue"
            elif eq.next_service_date == today:
                new_status = "Due Today"
            elif eq.next_service_date <= today + timedelta(days=14):
                new_status = "Due Soon"
            else:
                new_status = "On Schedule"
            if eq.service_status != new_status:
                eq.service_status = new_status
        for comp in db.query(ComponentModel).all():
            if not comp.last_service_date or not comp.service_interval_days or not comp.next_service_date:
                new_status = "Not Scheduled"
            elif comp.next_service_date < today:
                new_status = "Overdue"
            elif comp.next_service_date == today:
                new_status = "Due Today"
            elif comp.next_service_date <= today + timedelta(days=14):
                new_status = "Due Soon"
            else:
                new_status = "On Schedule"
            if comp.service_status != new_status:
                comp.service_status = new_status
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


create_tables()
ensure_schema_updates()
seed_default_admin()
recalculate_service_statuses()

# ── Daily scheduler ──────────────────────────────────────────────────────────
_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler.add_job(recalculate_service_statuses, "cron", hour=0, minute=0,
                   id="daily_service_status", replace_existing=True)
_scheduler.start()
atexit.register(lambda: _scheduler.shutdown(wait=False))

app = FastAPI(
    title="Maintenance Management API",
    version="1.0.0",
    description="Backend API for the plant maintenance tracking system",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(plants.router, prefix="/api/plants", tags=["Plants"])
app.include_router(equipment.router, prefix="/api/equipment", tags=["Equipment"])
app.include_router(equipment_components.router, prefix="/api/equipment-components", tags=["Equipment Components"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(maintenance_records.router, prefix="/api/records", tags=["Maintenance Records"])
app.include_router(import_excel.router, prefix="/api/import", tags=["Import"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(service_dashboard.router, prefix="/api/service-dashboard", tags=["Service Dashboard"])
app.include_router(service_history.router, prefix="/api/service-history", tags=["Service History"])
app.include_router(service_job_cards.router, prefix="/api/job-cards", tags=["Service Job Cards"])
app.include_router(parts_replacements.router, prefix="/api/parts-replacements", tags=["Parts Replacements"])
app.include_router(logs.router, prefix="/api/logs", tags=["Audit Logs"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Maintenance Management API"}
