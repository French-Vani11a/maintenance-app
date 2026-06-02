# Session Changes

## Equipment: New Fields — `manufacturer`, `model_number`, `description`

### Backend

**`backend/app/models/equipment.py`**
- Added `manufacturer` (`VARCHAR 200`, nullable)
- Added `model_number` (`VARCHAR 100`, nullable)
- Added `description` (`TEXT`, nullable)

**`backend/app/schemas/equipment.py`**
- Added `manufacturer`, `model_number`, `description` to `EquipmentBase` and `EquipmentUpdate`
- Added `RecentServiceHistory` response schema
- Added `RecentMaintenanceRecord` response schema
- Added `EquipmentDetails` response schema (extends `Equipment`, includes `recent_service_histories` and `recent_maintenance_records`)

**`backend/app/routers/equipment.py`**
- Updated `_enrich()` to include `manufacturer`, `model_number`, `description`
- Added `GET /equipment/{equipment_id}/details` endpoint
  - Returns full enriched equipment fields
  - Returns 5 most recent service history records (sorted by `service_date` desc)
  - Returns 5 most recent maintenance records (sorted by `record_date` desc)
- Imported `MaintenanceRecord` model for the details query

**`backend/alembic/versions/002_add_equipment_manufacturer_model_description.py`**
- New Alembic migration adding the three columns to the `equipment` table
- `down_revision` points to `001_add_equip_group`

**`backend/app/main.py`**
- Added `manufacturer`, `model_number`, `description` to `ensure_schema_updates()` so existing databases are patched on startup without running Alembic manually

### Frontend

**`frontend/src/types/index.ts`**
- Added `manufacturer?`, `model_number?`, `description?` to `Equipment` interface
- Added `EquipmentDetails` interface extending `Equipment` with `recent_service_histories` and `recent_maintenance_records` arrays

**`frontend/src/services/api.ts`**
- Added `EquipmentDetails` to type imports
- Added `getEquipmentDetails(id: number)` calling `GET /equipment/{id}/details`

---

## Equipment Management Page — UI Overhaul

**`frontend/src/pages/EquipmentManagement.tsx`**

### Add Equipment form
- Added Manufacturer, Model Number, and Description fields to the "Add Equipment" card form

### Equipment table
- Added **Manufacturer** and **Model No.** columns
- Removed inline row editing entirely — all edits now happen inside the Details modal
- Removed the Eye icon button, History button, and actions column
- Every table row is clickable and opens the Equipment Details modal

### Equipment Details modal
- Opens when a row is clicked
- **View mode** shows:
  - Equipment name and code in the header
  - Info grid: Plant, Group, Status, Manufacturer, Model Number, Last Service, Next Service, Service Status, Service Type, Interval
  - Description and Service Notes sections (shown only when populated)
  - Recent Service History table (up to 5 records): Date, Type, Performed By, Notes
  - Recent Maintenance Records table (up to 5 records): Date, MR No., Issue, Artisan, Downtime, Status
  - Edit (Pencil) and Delete (Trash) buttons in the header
- **Edit mode** (toggled by Pencil button) shows:
  - Full inline form: Name, Code, Status, Manufacturer, Model Number, Plant, Group, Last Service, Interval, Next Service (computed), Service Status (computed), Service Type, Service Notes, Description
  - Save / Cancel buttons
  - On save: calls update API, refreshes equipment list, refreshes modal data, returns to view mode
  - Pencil and Delete buttons hidden while editing
- Backdrop click closes the modal and resets edit mode

### Removed
- Inline service details panel (Service History list + add form, Parts Replacement list + add form) that previously appeared below the table
- All related state and handler functions (`activeEquipment`, `serviceHistory`, `partsReplacements`, `loadServiceDetails`, `openServicePanel`, `handleCreateServiceHistory`, `handleCreatePartsReplacement`)
- Unused imports: `Eye`, `createPartsReplacement`, `createServiceHistory`, `getPartsReplacements`, `getServiceHistory`, `ServiceHistory`, `PartsReplacement`
