# Update Performed By on Service History Records

Use this when service history records have an empty "Performed By" field because the artisan was not added to the job card before completion.

---

## Command

Run inside the Docker container, filling in the job card numbers and artisan names in the `updates` dictionary:

```
docker exec -it maintenance-app-backend-1 python -c "
import app.models.equipment_group, app.models.plant, app.models.equipment
import app.models.equipment_component, app.models.user, app.models.maintenance_record
from app.database import SessionLocal
from app.models.service_history import ServiceHistory
from app.models.service_job_card import ServiceJobCard

db = SessionLocal()

updates = {
    'JC-20260605-0003': 'Makuwaza and Goronga',
    'JC-20260605-0002': 'Mpofu and Mushuku',
    'JC-20260605-0001': 'Mpofu',
    'JC-20260605-0006': 'Makuwaza and Goronga',
    'JC-20260618-0002': 'Compressor Tech',
    'JC-20260605-0005': 'Mapuranga and Davi',
}

for jc_number, artisan in updates.items():
    jc = db.query(ServiceJobCard).filter(ServiceJobCard.job_card_number == jc_number).first()
    if jc:
        history = db.query(ServiceHistory).filter(ServiceHistory.job_card_id == jc.id).first()
        if history:
            history.performed_by = artisan
            print(f'Updated {jc_number} -> {artisan}')
        else:
            print(f'No history record found for {jc_number}')
    else:
        print(f'Job card not found: {jc_number}')

db.commit()
db.close()
print('Done.')
"
```

---

## How to use it

1. Open a terminal on the server
2. Edit the `updates` dictionary — add or remove job card number / artisan name pairs as needed
3. Run the command
4. The output will confirm which records were updated and which were not found

---

## Job card number format

Job card numbers follow the format `JC-YYYYMMDD-XXXX` where `XXXX` is a zero-padded 4-digit sequence number. Common mistakes to watch for:

- Spaces in the number — `JC -20260605-006` should be `JC-20260605-0006`
- Missing leading zero — `JC-20260605-003` should be `JC-20260605-0003`
- Incomplete date — `JC-2026018-002` should be `JC-20260618-0002`

---

## Note

This command directly updates the database. It does not affect the job card itself, only the linked service history record's "Performed By" field. This is safe to run multiple times — re-running it on already-updated records simply overwrites with the same value.

Going forward, the system automatically copies the assigned artisan to "Performed By" when a job card is completed, so this manual step should not be needed for new records.
