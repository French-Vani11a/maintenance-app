from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import auth, plants, equipment, users, maintenance_records, import_excel, dashboard, logs


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

    if "maintenance_records" not in tables:
        return

    columns = {c["name"] for c in inspector.get_columns("maintenance_records")}
    if "created_by_user_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE maintenance_records ADD COLUMN created_by_user_id INTEGER REFERENCES users(id)"))
    if "equipment_group_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE maintenance_records ADD COLUMN equipment_group_id INTEGER REFERENCES equipment_groups(id)"))


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


create_tables()
ensure_schema_updates()
seed_default_admin()

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
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(maintenance_records.router, prefix="/api/records", tags=["Maintenance Records"])
app.include_router(import_excel.router, prefix="/api/import", tags=["Import"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(logs.router, prefix="/api/logs", tags=["Audit Logs"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Maintenance Management API"}
