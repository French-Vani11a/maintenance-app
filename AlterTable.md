# Applying Database Column Changes to Production

Use this when you have added, removed, or modified columns on an existing table in the backend model (`app/models/`) but the production database has not been updated yet. SQLAlchemy will create missing **tables** automatically on startup, but it will **never** add or modify columns on tables that already exist — that must be done manually.

---

## Why this is needed

The backend model is the source of truth for what columns should exist. When a new column is added to a model (e.g. `is_slicer` on `MaintenanceRecord`), the production database still has the old schema. Every API call that touches that table will fail until the column exists in the database.

---

## How to run it

SSH into the production server, then run a `psql` command inside the postgres container:

```
docker exec maintenance-app-postgres-1 psql -U maintenance_user -d maintenance_db -c "
-- your ALTER TABLE statements here
"
```

### Example — what was run for the slicer feature (June 2026)

```
docker exec maintenance-app-postgres-1 psql -U maintenance_user -d maintenance_db -c "
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS is_slicer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS prev_hr_meter FLOAT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS curr_hr_meter FLOAT;
ALTER TABLE maintenance_records ALTER COLUMN run_time_minutes TYPE FLOAT USING run_time_minutes::float;
"
```

---

## Common operations

### Add a nullable column
```sql
ALTER TABLE your_table ADD COLUMN IF NOT EXISTS column_name COLUMN_TYPE;
```
Example:
```sql
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS notes TEXT;
```

### Add a non-nullable column with a default
```sql
ALTER TABLE your_table ADD COLUMN IF NOT EXISTS column_name COLUMN_TYPE NOT NULL DEFAULT value;
```
Example:
```sql
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS is_slicer BOOLEAN NOT NULL DEFAULT false;
```

### Change a column's type
```sql
ALTER TABLE your_table ALTER COLUMN column_name TYPE new_type USING column_name::new_type;
```
Example — integer to float:
```sql
ALTER TABLE maintenance_records ALTER COLUMN run_time_minutes TYPE FLOAT USING run_time_minutes::float;
```

### Rename a column
```sql
ALTER TABLE your_table RENAME COLUMN old_name TO new_name;
```

### Drop a column
```sql
ALTER TABLE your_table DROP COLUMN IF EXISTS column_name;
```

---

## Before running destructive changes

For any change that modifies or removes existing data (type changes, drops, data migrations), take a backup first:

```
docker exec maintenance-app-postgres-1 pg_dump -U maintenance_user maintenance_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

Keep the backup file somewhere safe before proceeding.

---

## After running the command

No restart is needed. The backend connects to the database on each request, so the new columns are available immediately. Verify by checking that the dashboard loads and records appear correctly.

---

## Common types reference

| Use case         | PostgreSQL type |
|------------------|-----------------|
| True/false flag  | `BOOLEAN`       |
| Whole number     | `INTEGER`       |
| Decimal number   | `FLOAT`         |
| Short text       | `VARCHAR(n)`    |
| Long text        | `TEXT`          |
| Date and time    | `TIMESTAMP`     |
| Foreign key (ID) | `INTEGER`       |
