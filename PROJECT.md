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
│   │       └── 002_add_equipment_manufacturer_model_description.py
│   ├── app/
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── equipment.py          # Equipment, EquipmentGroup
│   │   │   ├── maintenance_record.py
│   │   │   ├── parts_replacement.py
│   │   │   ├── plant.py
│   │   │   ├── service_history.py
│   │   │   └── user.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── dashboard.py
│   │   │   ├── equipment.py          # CRUD + /details endpoint
│   │   │   ├── import_excel.py
│   │   │   ├── logs.py
│   │   │   ├── maintenance_records.py
│   │   │   ├── parts_replacements.py
│   │   │   ├── plants.py
│   │   │   ├── service_dashboard.py
│   │   │   ├── service_history.py
│   │   │   └── users.py
│   │   ├── schemas/
│   │   │   ├── equipment.py          # EquipmentBase, Create, Update, Response, Details
│   │   │   ├── equipment_group.py
│   │   │   ├── maintenance_record.py
│   │   │   ├── parts_replacement.py
│   │   │   ├── service_history.py
│   │   │   └── user.py
│   │   ├── services/
│   │   │   └── audit_service.py      # log_action()
│   │   ├── config.py
│   │   ├── database.py               # SQLAlchemy engine, SessionLocal, Base
│   │   ├── main.py                   # App init, create_tables, ensure_schema_updates, seed
│   │   └── security.py               # JWT, password hashing, get_current_user
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── ProtectedRoute.tsx
    │   │   └── Sidebar.tsx
    │   ├── pages/
    │   │   ├── EquipmentManagement.tsx
    │   │   ├── RecordForm.tsx
    │   │   └── ServiceDashboard.tsx
    │   ├── services/
    │   │   └── api.ts                # Axios instance + all API functions
    │   ├── types/
    │   │   └── index.ts              # All TypeScript interfaces
    │   └── App.tsx
    └── package.json
```

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
- Every router uses `get_current_user` as a dependency for all endpoints
- Enrichment: use a `_enrich(obj)` helper that returns a dict with denormalized related names (e.g. `plant_name`, `equipment_group_name`)
- List endpoints return `{ "total": n, "items": [...] }` for paginated resources
- All create/update/delete actions call `log_action()` from `audit_service`
- Service date logic: `_calculate_next_service_date()` and `_derive_service_status()` helpers in the equipment router

### Audit logging
Every mutating action (create, update, delete) must call:
```python
log_action(db, current_user.id, "create"|"update"|"delete", "<item_type>", item.id, "Human-readable detail")
```

### Authentication
- JWT tokens issued on login via `/api/auth/login`
- All protected endpoints depend on `get_current_user` from `security.py`
- Roles: `admin`, `technician` — enforce in router dependencies where needed

---

## Frontend Conventions

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
- **Modals**: `fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto` backdrop with a `card w-full max-w-4xl my-8` inner panel; backdrop click closes

### Status badge colours
| Status | Classes |
|--------|---------|
| active / closed / On Schedule | `bg-green-100 text-green-800` |
| Overdue / open / error | `bg-red-100 text-red-800` |
| Due Soon / in-progress | `bg-yellow-100 text-yellow-800` |
| inactive / Not Scheduled | `bg-gray-100 text-gray-600` |

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

---

## Rules

- **Use existing API patterns** — follow the `_enrich()` + `log_action()` + `get_current_user` pattern in every new router
- **Use existing audit log pattern** — every mutating endpoint must call `log_action()`
- **Use existing role-based access** — check `current_user.role` where actions should be restricted to admins
- **Keep pages responsive** — use Tailwind responsive prefixes (`sm:`, `lg:`) and grid layouts; tables use `table-container` for horizontal scroll on small screens
- **Schema migrations** — always add both an Alembic migration file and an `ensure_schema_updates()` guard in `main.py` when adding columns
- **No hardcoded IDs or magic strings** — derive plant/group names from relationships via `_enrich()`
- **TypeScript types first** — define or update the interface in `types/index.ts` before writing the API call or component code
