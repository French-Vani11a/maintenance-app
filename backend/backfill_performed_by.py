"""
One-time backfill: copies assigned_artisan from service_job_cards
into performed_by on service_history records where performed_by is empty.

Run inside the Docker container:
  docker exec -it maintenance_backend python backfill_performed_by.py
"""

# Import all models first so SQLAlchemy can resolve all relationships
import app.models.equipment_group
import app.models.plant
import app.models.equipment
import app.models.equipment_component
import app.models.user
import app.models.service_history
import app.models.service_job_card
import app.models.maintenance_record

from app.database import SessionLocal
from app.models.service_history import ServiceHistory
from app.models.service_job_card import ServiceJobCard

db = SessionLocal()
try:
    records = (
        db.query(ServiceHistory)
        .filter(
            ServiceHistory.performed_by == None,
            ServiceHistory.job_card_id != None,
        )
        .all()
    )

    print(f"Found {len(records)} service history records with empty performed_by...")

    updated = 0
    for record in records:
        jc = db.query(ServiceJobCard).filter(ServiceJobCard.id == record.job_card_id).first()
        if jc and jc.assigned_artisan:
            record.performed_by = jc.assigned_artisan
            updated += 1

    db.commit()
    print(f"Updated {updated} records.")
    print(f"Skipped {len(records) - updated} records (job card had no assigned artisan).")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
