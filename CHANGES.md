# Session Changes

---

## Equipment Details Modal — Service Button

**`frontend/src/pages/EquipmentManagement.tsx`**

### New imports
- `completeJobCard`, `getJobCards` added to API imports
- `Zap` added to lucide-react imports
- `ServiceJobCard` added to type imports

### New state
| State | Type | Purpose |
|-------|------|---------|
| `equipmentActiveCard` | `ServiceJobCard \| null` | Non-completed job card for the currently open equipment |
| `completeForm` | object | Completion fields: `service_date`, `performed_by`, `work_done`, `parts_used`, `completion_notes` |
| `completing` | boolean | Loading flag for the complete action |

### New functions

**`loadEquipmentActiveCard(equipmentId)`**
- Calls `getJobCards({ equipment_id, limit: 20 })`, picks the first non-completed card
- Sets `equipmentActiveCard` to that card or `null`

**`handleCompleteFromModal()`**
- Validates `service_date` is provided
- Calls `completeJobCard` with completion data
- Re-fetches equipment details (`getEquipmentDetails`) so last/next service dates and service status update live in the modal
- Re-runs `loadEquipmentActiveCard` to clear the active card and revert the button
- Refreshes the equipment list table
- Shows "Service completed and history recorded." success banner

### Updated `openDetailsModal`
- Now calls `getEquipmentDetails` and `loadEquipmentActiveCard` in parallel (`Promise.all`) so the active card is known as soon as the modal opens

### Updated `handleCreateJobCard`
- After successfully creating a job card, calls `loadEquipmentActiveCard` so the header button immediately switches from Zap → Mark Complete

### Updated `useEffect` cleanup (watches `detailsModal`)
- Now also resets `equipmentActiveCard`, `completeForm`, and `completing` when the modal closes

### Modal header button (smart toggle)
- **`equipmentActiveCard` is `null`** → Zap icon button. Clicking pre-fills `service_type` from the equipment's own service type and `due_date` from `next_service_date`, then toggles the create form
- **`equipmentActiveCard` exists** → green **Mark Complete** button (shows job card number as tooltip). Clicking opens the completion form directly (`showServiceForm = true`)
- Both buttons hidden when the edit form is active (`modalEditing`)

### Service form section (smart create / complete)
Renders below the info grid, above the history tables:

**Create form** (no active card) — fields: Service Type (pre-filled from equipment service type), Due Date (pre-filled from `next_service_date`), Assigned Artisan, Priority, Service Description, Work To Be Done, Parts Required, Notes. Actions: **Save Job Card** / **Cancel**

**Complete form** (active card exists) — header shows job card number. Fields: Service Date (required), Performed By, Work Done, Parts Used, Completion Notes. Actions: **Confirm Complete** / **Cancel**

### Success banner
- Green banner appears after both create and complete actions
- Dismissed with X button or clears on next action

---

---

## Service Now — Smart Service Button (Equipment Row)

**`frontend/src/pages/ServiceNow.tsx`**

### Problem
The "Service" button on every equipment row always opened a new job card form, even when an open or in-progress job card already existed for that equipment.

### Fix

**New state** `activeCardsByEquipmentId: Record<number, ServiceJobCard>`
- A map keyed by `equipment_id` containing only non-completed (open / in-progress) job cards.
- Kept separate from the `jobCards` display table state so it is never affected by the user's status filter.

**New function** `loadActiveCards()`
- Fetches all job cards without a status filter, then builds the `activeCardsByEquipmentId` map from those where `status !== 'completed'`.
- Called on component mount and after every mutation: create, save-and-print, complete, delete.

**New function** `openViewModalWithComplete(card)`
- Opens the view modal for an existing job card with the completion form pre-expanded (`showCompleteForm = true`), so the user lands directly on the completion fields.

**Button logic** — applied to both the *Equipment Due for Service* table and the *Create Job Card for Any Equipment* (manual search) table:
- Equipment **with** an active (open / in-progress) job card → green **Mark Complete** button → opens the existing job card's modal with the completion form already expanded
- Equipment **without** an active job card → blue **Service** button → opens the create modal as before

**Summary card** — "Open Job Cards" count now derived from `Object.keys(activeCardsByEquipmentId).length` (always accurate regardless of the table's status filter)

---

---

## Service Now — Preventive Maintenance Module

### Backend

**`backend/app/models/service_job_card.py`** *(new)*
- New `ServiceJobCard` SQLAlchemy model (`service_job_cards` table)
- Fields: `id`, `job_card_number` (auto-generated, unique), `equipment_id` (FK), `plant_id` (FK), `service_type`, `due_date`, `service_description`, `work_to_be_done`, `assigned_artisan`, `parts_required`, `priority` (low / medium / high / critical, default medium), `notes`, `status` (open / in-progress / completed, default open), `completed_date`, `created_by_user_id` (FK), `created_at`, `updated_at`
- Relationships to `Equipment`, `Plant`, `User`

**`backend/app/models/service_history.py`**
- Added `work_done` (TEXT, nullable)
- Added `parts_used` (TEXT, nullable)
- Added `job_card_id` (INTEGER FK → `service_job_cards.id`, nullable)
- Added `job_card` relationship

**`backend/app/models/__init__.py`**
- Imported and exported `ServiceJobCard` so `create_tables()` picks it up

**`backend/app/schemas/service_job_card.py`** *(new)*
- `ServiceJobCardBase` — shared fields
- `ServiceJobCardCreate` — create payload
- `ServiceJobCardUpdate` — partial update (all optional)
- `ServiceJobCardComplete` — completion payload: `service_date`, `performed_by`, `work_done`, `parts_used`, `completion_notes`
- `ServiceJobCard` — response schema with enriched `equipment_name`, `equipment_code`, `plant_name`, `created_by_user_name`

**`backend/app/schemas/service_history.py`**
- Added `work_done`, `parts_used`, `job_card_id` to `ServiceHistoryBase`
- Added `equipment_name`, `equipment_code`, `plant_id`, `plant_name`, `job_card_number` to `ServiceHistory` response schema

**`backend/app/routers/service_job_cards.py`** *(new)*
- `GET /job-cards/due-equipment` — equipment overdue or due within the next 7 days; supports `search` and `plant_id` filters
- `GET /job-cards/search-equipment` — search any equipment by name (for manual job card creation)
- `GET /job-cards/` — list job cards with filters: `status`, `plant_id`, `equipment_id`, `priority`, `search`; returns `{ total, job_cards }`
- `POST /job-cards/` — create job card; auto-generates `job_card_number` (`JC-YYYYMMDD-NNNN`); auto-sets `plant_id` from equipment if not supplied; logs via `log_action`
- `PUT /job-cards/{id}` — update job card fields; logs via `log_action`
- `POST /job-cards/{id}/complete` — marks job card completed; creates a `ServiceHistory` record; updates equipment `last_service_date`, recalculates `next_service_date` and `service_status`; logs both actions
- `DELETE /job-cards/{id}` — delete job card; logs via `log_action`
- All endpoints use `get_current_user` dependency

**`backend/app/routers/service_history.py`**
- Rewrote `GET /` to accept optional filters: `equipment_id`, `plant_id`, `date_from`, `date_to`, `artisan`, `service_type`, `search`; supports `skip`/`limit` pagination
- Returns `{ total, records }` with enriched fields (`equipment_name`, `equipment_code`, `plant_name`, `job_card_number`, `work_done`, `parts_used`)
- Added `_enrich_history()` helper following the project `_enrich()` pattern

**`backend/alembic/versions/003_add_service_job_cards.py`** *(new)*
- Creates `service_job_cards` table with all columns and indexes
- Adds `work_done`, `parts_used`, `job_card_id` columns to `service_history`
- `down_revision` points to `002_add_equipment_fields`

**`backend/app/main.py`**
- Imported and registered `service_job_cards` router at `/api/job-cards`
- Added `ensure_schema_updates` guards for `work_done`, `parts_used`, `job_card_id` on `service_history` table

### Frontend

**`frontend/src/types/index.ts`**
- Added `DueEquipment` interface
- Added `ServiceJobCard` interface
- Added `EnrichedServiceHistory` interface
- Added `ServiceHistoryResponse` interface (`{ total, records }`)
- Added `JobCardsResponse` interface (`{ total, job_cards }`)

**`frontend/src/services/api.ts`**
- Added imports: `DueEquipment`, `EnrichedServiceHistory`, `JobCardsResponse`, `ServiceHistoryResponse`, `ServiceJobCard`
- Updated `getServiceHistory` to work with new paginated response shape
- Added `getEnrichedServiceHistory(params)` — paginated, filtered history endpoint
- Added `getDueEquipment(params?)` — equipment overdue/due within 7 days
- Added `searchAllEquipment(search, plant_id?)` — free-text equipment search
- Added `getJobCards(params?)` — list job cards with filters
- Added `createJobCard(data)` — create job card
- Added `updateJobCard(id, data)` — update job card
- Added `completeJobCard(id, data)` — complete with service details
- Added `deleteJobCard(id)` — delete job card

**`frontend/src/pages/ServiceNow.tsx`** *(new)*

Two-tab page:

**Tab 1 — Service Due / Job Cards**
- Summary cards: Overdue count (red), Due within 7 days (yellow), Open Job Cards (blue)
- *Equipment Due for Service* table: filtered by name/plant; columns: Equipment, Plant, Service Type, Last Service, Next Due, Status, **Service** button
- *Create Job Card for Any Equipment* panel: free-text search for any equipment; results table with **Service** button
- *Job Cards* table: filterable by search/status; columns: Job Card #, Equipment, Plant, Artisan, Priority, Due Date, Status, Print/Delete actions; row click opens view modal

**Create Job Card modal** (triggered by any Service button)
- Pre-fills equipment, plant, service type, due date from selected equipment row
- Fields: Service Type, Due Date, Assigned Artisan, Priority, Service Description, Work To Be Done, Parts Required, Notes
- Actions: **Save**, **Save & Print** (saves then opens print window), **Cancel**

**View / Edit Job Card modal** (triggered by row click)
- Header: job card number, status badge, priority badge, Print button, Close button
- Info grid: Equipment, Plant, Created By, Due Date, Completed Date
- Editable fields when open/in-progress: Service Type, Due Date, Artisan, Priority, Status, Work To Be Done, Parts Required, Notes; **Save Changes** button
- **Mark as Completed** button expands an inline form: Service Date (required), Performed By, Work Done, Parts Used, Completion Notes; **Confirm Complete** calls the complete endpoint → creates service history, updates equipment dates
- Read-only view when status is completed

**Print** — `printJobCard()` opens a new browser window with formatted HTML job card (equipment, plant, artisan, priority, all text fields, signature lines) and calls `window.print()`

**Tab 2 — Service History**
- Filter panel: Equipment search, Plant, Service Type, Date From, Date To, Artisan; **Apply Filters** / **Clear** buttons
- Results table: Date, Equipment, Plant, Service Type, Performed By, Work Done, Parts Used, Job Card #
- Pagination (25 per page)

**`frontend/src/components/Sidebar.tsx`**
- Added `Zap` icon import
- Added **Service Now** nav item (`/service-now`) between Equipment and Service Dashboard

**`frontend/src/App.tsx`**
- Imported `ServiceNow` page
- Added `/service-now` route

**`frontend/src/components/Layout.tsx`**
- Added `'/service-now': 'Service Now'` to `PAGE_TITLES`

---

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
