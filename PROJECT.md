# Project Structure & Rules

## Architecture

**Frontend**
- React
- TypeScript
- Axios

**Backend**
- FastAPI
- SQLAlchemy
- Alembic

**Database**
- PostgreSQL

---

## Project Structure

```
maintenance-app/
├── backend/
│   ├── alembic/
│   │   └── versions/
│   │       ├── 001_add_equipment_group_to_records.py
│   │       ├── 002_add_equipment_manufacturer_model_description.py
│   │       └── 003_add_service_job_cards.py
│   ├── app/
│   │   ├── models/
│   │   │   ├── __init__.py               # imports all models for create_tables()
│   │   │   ├── audit_log.py
│   │   │   ├── equipment.py              # Equipment, EquipmentGroup
│   │   │   ├── fault_category.py
│   │   │   ├── maintenance_record.py
│   │   │   ├── parts_replacement.py
│   │   │   ├── plant.py
│   │   │   ├── service_history.py        # work_done, parts_used, job_card_id
│   │   │   ├── service_job_card.py       # ServiceJobCard
│   │   │   └── user.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── dashboard.py
│   │   │   ├── equipment.py              # CRUD + /details endpoint
│   │   │   ├── import_excel.py
│   │   │   ├── logs.py
│   │   │   ├── maintenance_records.py
│   │   │   ├── parts_replacements.py
│   │   │   ├── plants.py
│   │   │   ├── service_dashboard.py      # analytics/stats only
│   │   │   ├── service_history.py        # filterable list + enrichment
│   │   │   ├── service_job_cards.py      # CRUD + due-equipment + complete
│   │   │   └── users.py
│   │   ├── schemas/
│   │   │   ├── equipment.py              # Base, Create, Update, Response, Details
│   │   │   ├── equipment_group.py
│   │   │   ├── maintenance_record.py
│   │   │   ├── parts_replacement.py
│   │   │   ├── service_history.py        # enriched response fields
│   │   │   ├── service_job_card.py       # Base, Create, Update, Complete, Response
│   │   │   └── user.py
│   │   ├── services/
│   │   │   └── audit_service.py          # log_action()
│   │   ├── config.py
│   │   ├── database.py                   # SQLAlchemy engine, SessionLocal, Base
│   │   ├── main.py                       # App init, create_tables, ensure_schema_updates, seed
│   │   └── security.py                   # JWT, password hashing, get_current_user
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.tsx                # sticky header, PAGE_TITLES map
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── ProtectedRoute.tsx
    │   │   └── Sidebar.tsx               # nav items + admin/general sections
    │   ├── pages/
    │   │   ├── AdminLogs.tsx
    │   │   ├── ChangePassword.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── EquipmentManagement.tsx   # equipment + details modal (edit/delete in modal)
    │   │   ├── ImportPage.tsx
    │   │   ├── Login.tsx
    │   │   ├── MaintenanceRecords.tsx
    │   │   ├── RecordForm.tsx
    │   │   ├── Reports.tsx
    │   │   ├── ServiceDashboard.tsx      # analytics/summary only
    │   │   ├── ServiceNow.tsx            # job cards + service history (execution)
    │   │   └── UsersManagement.tsx
    │   ├── services/
    │   │   └── api.ts                    # Axios instance + all API functions
    │   ├── types/
    │   │   └── index.ts                  # all TypeScript interfaces
    │   ├── contexts/
    │   │   └── AuthContext.tsx
    │   └── App.tsx                       # routes
    └── package.json
```

---

## API Routes

| Prefix | Router file | Purpose |
|--------|-------------|---------|
| `/api/auth` | `auth.py` | Login, get current user |
| `/api/plants` | `plants.py` | Plant CRUD |
| `/api/equipment` | `equipment.py` | Equipment CRUD, groups, `/details` |
| `/api/users` | `users.py` | User CRUD, password change |
| `/api/records` | `maintenance_records.py` | Maintenance record CRUD + CSV export |
| `/api/import` | `import_excel.py` | Excel import preview + commit |
| `/api/dashboard` | `dashboard.py` | Fault/downtime analytics |
| `/api/service-dashboard` | `service_dashboard.py` | Service status analytics only |
| `/api/service-history` | `service_history.py` | Service history with filters + enrichment |
| `/api/job-cards` | `service_job_cards.py` | Job card CRUD, due equipment, complete |
| `/api/parts-replacements` | `parts_replacements.py` | Parts replacement schedules |
| `/api/logs` | `logs.py` | Audit log listing |

### Key job card endpoints
| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/job-cards/due-equipment` | Equipment overdue or due within 7 days |
| `GET` | `/api/job-cards/search-equipment` | Free-text search across all equipment |
| `GET` | `/api/job-cards/` | List job cards (filters: status, plant, equipment, priority, search) |
| `POST` | `/api/job-cards/` | Create job card (auto-generates job card number) |
| `PUT` | `/api/job-cards/{id}` | Update job card fields |
| `POST` | `/api/job-cards/{id}/complete` | Complete → creates service history + updates equipment dates |
| `DELETE` | `/api/job-cards/{id}` | Delete job card |

---

## Data Model Notes

### Equipment service date lifecycle
1. `last_service_date` is set manually or automatically when a job card is completed
2. `next_service_date = last_service_date + service_interval_days`
3. `service_status` derived: `Overdue` / `Due Soon` (≤14 days) / `On Schedule` / `Not Scheduled`
4. Recalculated in `_prepare_service_fields()` (equipment router) and `_update_equipment_after_service()` (job cards router)

### Job card lifecycle
1. Created (status: **open**) — equipment stays due/overdue
2. Optionally updated to **in-progress**
3. Marked **completed** via `POST /job-cards/{id}/complete`:
   - Creates a `ServiceHistory` record (with `job_card_id` link)
   - Updates equipment `last_service_date`, recalculates `next_service_date` and `service_status`
   - Logs two audit entries (job card update + service history create)

### ServiceHistory enrichment
Every history record response includes: `equipment_name`, `equipment_code`, `plant_name`, `job_card_number`, `work_done`, `parts_used`

---

## Backend Conventions

### Adding a new model
1. Create `app/models/<name>.py` — SQLAlchemy class extending `Base`
2. Import the model in `app/models/__init__.py` so `create_tables()` picks it up
3. Create `app/schemas/<name>.py` — `Base`, `Create`, `Update`, `Response` Pydantic models
4. Create `app/routers/<name>.py` — FastAPI router with CRUD endpoints
5. Register the router in `app/main.py` with `app.include_router(...)`

### Adding columns to an existing table
1. Add the column to the SQLAlchemy model
2. Add the field to the relevant Pydantic schemas
3. Update `_enrich()` in the router to include the field in responses
4. Create an Alembic migration in `alembic/versions/`
5. Add an `if "<column>" not in columns` guard in `ensure_schema_updates()` in `main.py` so existing databases are patched on startup

### Router patterns
- Every router uses `get_current_user` as a dependency on all endpoints
- Enrichment: use a `_enrich(obj)` helper returning a dict with denormalized related names (e.g. `plant_name`, `equipment_name`)
- List endpoints return `{ "total": n, "items": [...] }` (or `{ "total": n, "<resource>": [...] }`) for paginated resources
- All create / update / delete actions call `log_action()` from `audit_service`

### Audit logging
Every mutating action must call:
```python
log_action(db, current_user.id, "create"|"update"|"delete", "<item_type>", item.id, "Human-readable detail")
```

### Authentication
- JWT tokens issued on login via `/api/auth/login`
- All protected endpoints depend on `get_current_user` from `security.py`
- Roles: `admin`, `technician` — enforce in router dependencies where needed

---

## Frontend Conventions

### Adding a new page
1. Create the page component in `frontend/src/pages/`
2. Add a route in `App.tsx`
3. Add a nav entry in `Sidebar.tsx` (main `nav` array, or `adminNav` for admin-only)
4. Add the page title in `Layout.tsx` `PAGE_TITLES`

### Adding a new API call
1. Add the TypeScript interface(s) to `src/types/index.ts`
2. Add the function to `src/services/api.ts` using the existing Axios instance
3. The Axios instance automatically attaches the JWT Bearer token and redirects to `/login` on 401

### Component patterns
- **Tables**: `<div className="table-container"><table className="table">` — use `badge` classes for status chips
- **Cards / panels**: `<div className="card space-y-4">`
- **Forms**: `<label className="label">` + `<input className="input">` or `<select className="input">`
- **Buttons**: `btn-primary`, `btn-secondary`, `btn-sm` utility classes
- **Error banners**: `rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600`
- **Loading state**: `<LoadingSpinner size="lg" />` centred in a `flex h-48 items-center justify-center` wrapper
- **Modals**: `fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto` backdrop with a `card w-full max-w-4xl my-8` inner panel; backdrop click closes and resets state

### Status badge colours
| Status | Classes |
|--------|---------|
| active / closed / On Schedule / completed | `bg-green-100 text-green-800` |
| Overdue / open / error | `bg-red-100 text-red-800` |
| Due Soon / in-progress / warning | `bg-yellow-100 text-yellow-800` |
| in-progress (job cards) | `bg-blue-100 text-blue-800` |
| inactive / Not Scheduled | `bg-gray-100 text-gray-600` |

### Priority badge colours (job cards)
| Priority | Classes |
|----------|---------|
| critical | `bg-red-100 text-red-800` |
| high | `bg-orange-100 text-orange-800` |
| medium | `bg-yellow-100 text-yellow-800` |
| low | `bg-green-100 text-green-800` |

### Service date logic (frontend mirror)
```ts
// Next service date
const next = new Date(lastServiceDate)
next.setDate(next.getDate() + intervalDays)

// Service status
if (next < today)            → "Overdue"
if (next <= today + 14 days) → "Due Soon"
else                         → "On Schedule"
```

### Job card button logic (ServiceNow page)
Equipment rows maintain a separate `activeCardsByEquipmentId` map (non-completed job cards keyed by `equipment_id`):
- Equipment **with** an active card → green **Mark Complete** button → opens view modal with completion form pre-expanded
- Equipment **without** an active card → blue **Service** button → opens create modal

The map is loaded independently of the job cards display table so the status filter on the table never affects button state.

---

## Rules

- **Use existing API patterns** — follow the `_enrich()` + `log_action()` + `get_current_user` pattern in every new router
- **Use existing audit log pattern** — every mutating endpoint must call `log_action()`
- **Use existing role-based access** — check `current_user.role` where actions should be restricted to admins
- **Keep pages responsive** — use Tailwind responsive prefixes (`sm:`, `lg:`) and grid layouts; tables use `table-container` for horizontal scroll on small screens
- **Schema migrations** — always add both an Alembic migration file and an `ensure_schema_updates()` guard in `main.py` when adding columns to existing tables
- **No hardcoded IDs or magic strings** — derive plant/group/equipment names from relationships via `_enrich()`
- **TypeScript types first** — define or update the interface in `types/index.ts` before writing the API call or component code
- **Service execution lives in Service Now** — the Service Dashboard is analytics/summary only; all job card creation and completion actions belong in ServiceNow.tsx
- **Job card completion is the trigger** — equipment service dates are only updated when a job card is marked completed via `POST /job-cards/{id}/complete`, not when a job card is created
