# Maintenance Management System — Technical Documentation

**Version:** 1.0  
**Last Updated:** June 2026  
**System:** Proton Bakers CMMS (Computerised Maintenance Management System)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture)
3. [Database Architecture](#3-database-architecture)
4. [System Blueprint](#4-system-blueprint)
5. [Core Modules](#5-core-modules)
6. [User Roles and Access](#6-user-roles-and-access)
7. [How the System Works](#7-how-the-system-works)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Grafana / Reporting Integration](#9-grafana--reporting-integration)
10. [Backup and Maintenance Plan](#10-backup-and-maintenance-plan)

---

## 1. System Overview

The Proton Bakers Maintenance Management System is a full-stack web application built to manage all plant maintenance activities across multiple facilities. It replaces manual spreadsheet-based tracking with a centralised, real-time system accessible from any browser.

### Purpose

- Track all corrective and preventive maintenance activities
- Manage equipment service schedules and predict due dates
- Create, assign, and complete service job cards
- Monitor overdue and at-risk equipment proactively
- Import historical records from Excel
- Provide management with dashboards, KPIs, and exportable reports

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| Maintenance Records | Log every fault, breakdown, and repair with full details |
| Equipment Management | Manage all plant assets with service schedules |
| Preventive Maintenance | Service job cards, due tracking, automatic status updates |
| Service History | Complete audit trail of all services performed |
| Dashboards | Real-time KPIs for operations and maintenance teams |
| Notifications | Live bell notifications for overdue, due-today, and due-soon items |
| Excel Import | Bulk import of historical maintenance records |
| PDF Job Cards | Print-ready job cards for field technicians |
| Audit Logs | Full audit trail of all user actions |

---

## 2. System Architecture

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.x |
| Frontend Language | TypeScript | 5.x |
| Frontend Styling | Tailwind CSS | 3.x |
| Frontend HTTP | Axios | 1.x |
| Frontend Routing | React Router | 6.x |
| Frontend Charts | Recharts | 2.x |
| Frontend Build | Vite | 5.x |
| Backend Framework | FastAPI | 0.109.x |
| Backend Language | Python | 3.10+ |
| ORM | SQLAlchemy | 2.0.x |
| Schema Validation | Pydantic | 2.x |
| Authentication | JWT (python-jose) | 3.3.x |
| Password Hashing | bcrypt / passlib | 4.0.x |
| Scheduler | APScheduler | 3.10.x |
| Database | PostgreSQL | 14+ |
| Database Driver | psycopg2-binary | 2.9.x |
| Excel Processing | pandas + openpyxl | latest |
| ASGI Server | uvicorn | 0.27.x |
| Migrations (ref) | Alembic | 1.13.x |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                              │
│                                                                     │
│   React + TypeScript + Tailwind CSS + Axios                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│   │  Dashboard   │  │  Maintenance │  │  Equipment / Service Now │ │
│   │  Service DB  │  │  Records     │  │  Notification Bell       │ │
│   └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTPS / REST API (JSON)
                               │  Authorization: Bearer <JWT>
┌──────────────────────────────▼──────────────────────────────────────┐
│                       FASTAPI BACKEND                                │
│                                                                     │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│   │  Auth      │ │  Equipment │ │  Records   │ │  Job Cards     │  │
│   │  Router    │ │  Router    │ │  Router    │ │  Router        │  │
│   └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│   │  Service   │ │  Dashboard │ │  Import    │ │  APScheduler   │  │
│   │  History   │ │  Router    │ │  Router    │ │  (midnight)    │  │
│   └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│                                                                     │
│   SQLAlchemy ORM  ·  Pydantic Schemas  ·  JWT Middleware            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  SQLAlchemy / psycopg2
┌──────────────────────────────▼──────────────────────────────────────┐
│                        POSTGRESQL DATABASE                          │
│                                                                     │
│   plants · equipment · equipment_groups · maintenance_records       │
│   service_history · service_job_cards · users · audit_logs         │
│   fault_categories · parts_replacement                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Request / Response Flow

1. User interacts with the React frontend
2. Axios sends an HTTP request with a JWT Bearer token in the `Authorization` header
3. FastAPI validates the token via the `get_current_user` dependency
4. The router handler queries PostgreSQL via SQLAlchemy, enriches the result with related names, and returns JSON
5. React updates the UI with the response data

---

## 3. Database Architecture

### Entity Relationship Summary

```
plants ──────────────────────────────────────────────────────────────┐
  │ 1                                                                │
  │ ∞                                                                │
equipment_groups ──────────────────────────────────┐                 │
  │ 1                                               │                │
  │ ∞                                               │                │
equipment ─────────────────────────────────────────┘                 │
  │ 1                                               │                │
  ├── ∞ ──────── service_history ◄── job_card_id ── service_job_cards│
  ├── ∞ ──────── parts_replacement                                   │
  └── ∞ ──────── maintenance_records ─────────────────────────────── ┘

users ──── ∞ ──── maintenance_records (created_by_user_id)
users ──── ∞ ──── service_job_cards   (created_by_user_id)
users ──── ∞ ──── audit_logs          (user_id)

fault_categories ──── ∞ ──── maintenance_records
```

### Table Definitions

#### `plants`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | VARCHAR(200) | Unique |

#### `equipment_groups`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| plant_id | INTEGER FK | → plants.id |
| name | VARCHAR(200) | |

#### `equipment`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| plant_id | INTEGER FK | → plants.id |
| equipment_group_id | INTEGER FK | → equipment_groups.id |
| equipment_name | VARCHAR(300) | |
| equipment_code | VARCHAR(100) | |
| status | VARCHAR(20) | active / inactive |
| manufacturer | VARCHAR(200) | |
| model_number | VARCHAR(100) | |
| description | TEXT | |
| last_service_date | DATE | |
| service_interval_days | INTEGER | |
| next_service_date | DATE | Calculated |
| service_type | VARCHAR(100) | |
| service_notes | TEXT | |
| service_status | VARCHAR(30) | Overdue / Due Today / Due Soon / On Schedule / Not Scheduled |

#### `maintenance_records`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| record_date | DATETIME | |
| time_reported | VARCHAR(20) | HH:MM |
| reporter_name | VARCHAR(200) | |
| reported_to | VARCHAR(200) | |
| artisan_name | VARCHAR(200) | |
| mr_no | VARCHAR(100) | Maintenance Request number |
| plant_id | INTEGER FK | → plants.id |
| equipment_id | INTEGER FK | → equipment.id |
| equipment_group_id | INTEGER FK | → equipment_groups.id |
| issue_description | TEXT | |
| arrival_time | VARCHAR(20) | HH:MM |
| finishing_time | VARCHAR(20) | HH:MM |
| downtime_minutes | INTEGER | Auto-calculated |
| remarks | TEXT | |
| status | VARCHAR(30) | open / in-progress / closed |
| record_type | VARCHAR(20) | regular / breakdown (default: regular) |
| fault_category_id | INTEGER FK | → fault_categories.id |
| created_by_user_id | INTEGER FK | → users.id |
| created_at | DATETIME | |
| updated_at | DATETIME | |

#### `service_job_cards`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| job_card_number | VARCHAR(30) | Auto-generated: JC-YYYYMMDD-NNNN |
| equipment_id | INTEGER FK | → equipment.id |
| plant_id | INTEGER FK | → plants.id |
| service_type | VARCHAR(100) | |
| start_date | DATE | |
| due_date | DATE | |
| service_description | TEXT | |
| work_to_be_done | TEXT | JSON array of task strings |
| assigned_artisan | VARCHAR(150) | |
| assigned_by | VARCHAR(150) | |
| parts_required | TEXT | JSON array of part strings |
| priority | VARCHAR(20) | low / medium / high / critical |
| notes | TEXT | |
| status | VARCHAR(20) | open / in-progress / completed |
| completed_date | DATE | |
| created_by_user_id | INTEGER FK | → users.id |
| created_at | DATETIME | |
| updated_at | DATETIME | |

#### `service_history`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| equipment_id | INTEGER FK | → equipment.id |
| service_date | DATE | |
| service_type | VARCHAR(100) | |
| performed_by | VARCHAR(100) | |
| notes | TEXT | |
| work_done | TEXT | JSON array or free text |
| parts_used | TEXT | JSON array or free text |
| job_card_id | INTEGER FK | → service_job_cards.id (nullable) |
| created_at | DATETIME | |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| username | VARCHAR(100) | Unique |
| full_name | VARCHAR(200) | |
| email | VARCHAR(200) | |
| hashed_password | VARCHAR | bcrypt |
| role | VARCHAR(20) | admin / technician |
| is_active | BOOLEAN | |

#### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| user_id | INTEGER FK | → users.id |
| action | VARCHAR(20) | create / update / delete / import |
| item_type | VARCHAR(50) | maintenance_record / equipment / service_job_card / etc. |
| item_id | INTEGER | ID of the affected record |
| details | TEXT | Human-readable summary |
| timestamp | DATETIME | |

### Service Status Logic

```
next_service_date < today           → "Overdue"
next_service_date == today          → "Due Today"
next_service_date <= today + 14d    → "Due Soon"
next_service_date > today + 14d     → "On Schedule"
no dates / no interval              → "Not Scheduled"
```

This is recalculated:
- On every API response (`_enrich()` in equipment router)
- On server startup (`recalculate_service_statuses()`)
- Daily at 00:00 UTC via APScheduler

---

## 4. System Blueprint

### Directory Structure

```
maintenance-app/
├── backend/
│   ├── alembic/
│   │   └── versions/                     # Migration reference files
│   │       ├── 001_add_equipment_group_to_records.py
│   │       ├── 002_add_equipment_manufacturer_model_description.py
│   │       ├── 003_add_service_job_cards.py
│   │       ├── 004_add_job_card_assigned_by_start_date.py
│   │       └── 005_add_record_type_to_maintenance_records.py
│   ├── app/
│   │   ├── models/                        # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── audit_log.py
│   │   │   ├── equipment.py
│   │   │   ├── equipment_group.py
│   │   │   ├── fault_category.py
│   │   │   ├── maintenance_record.py
│   │   │   ├── parts_replacement.py
│   │   │   ├── plant.py
│   │   │   ├── service_history.py
│   │   │   ├── service_job_card.py
│   │   │   └── user.py
│   │   ├── routers/                       # FastAPI route handlers
│   │   │   ├── auth.py                    # Login, JWT
│   │   │   ├── dashboard.py               # Fault/downtime analytics
│   │   │   ├── equipment.py               # Equipment CRUD + details
│   │   │   ├── import_excel.py            # Excel import + template
│   │   │   ├── logs.py                    # Audit log listing
│   │   │   ├── maintenance_records.py     # Records CRUD + export
│   │   │   ├── parts_replacements.py
│   │   │   ├── plants.py
│   │   │   ├── service_dashboard.py       # Service KPI analytics
│   │   │   ├── service_history.py         # Service history CRUD
│   │   │   ├── service_job_cards.py       # Job cards CRUD + complete
│   │   │   └── users.py
│   │   ├── schemas/                       # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── audit_service.py           # log_action() helper
│   │   │   └── excel_importer.py          # Excel parsing logic
│   │   ├── config.py                      # Environment settings
│   │   ├── database.py                    # SQLAlchemy engine
│   │   ├── main.py                        # App startup, scheduler
│   │   └── security.py                    # JWT, password hashing
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── jblogo.jpg                     # Company logo (job card print)
    ├── src/
    │   ├── components/
    │   │   ├── Layout.tsx                 # App shell, notification bell
    │   │   ├── ListInput.tsx              # Reusable list editor
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── NotificationBell.tsx       # Live notification badge
    │   │   ├── ProtectedRoute.tsx
    │   │   └── Sidebar.tsx                # Navigation with groups
    │   ├── contexts/
    │   │   └── AuthContext.tsx
    │   ├── pages/
    │   │   ├── AdminLogs.tsx
    │   │   ├── ChangePassword.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── EquipmentManagement.tsx
    │   │   ├── ImportPage.tsx
    │   │   ├── Login.tsx
    │   │   ├── MaintenanceRecords.tsx
    │   │   ├── RecordForm.tsx
    │   │   ├── Reports.tsx
    │   │   ├── ServiceDashboard.tsx
    │   │   ├── ServiceNow.tsx
    │   │   └── UsersManagement.tsx
    │   ├── services/
    │   │   └── api.ts                     # All API calls
    │   └── types/
    │       └── index.ts                   # TypeScript interfaces
    └── package.json
```

### API Route Map

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Authenticate, receive JWT |
| GET | /api/auth/me | Get current user |
| GET | /api/plants/ | List all plants |
| POST/PUT/DELETE | /api/plants/{id} | Plant CRUD |
| GET | /api/equipment/ | List equipment with filters |
| GET | /api/equipment/{id}/details | Equipment + recent history |
| POST/PUT/DELETE | /api/equipment/{id} | Equipment CRUD |
| GET | /api/equipment/groups/ | List equipment groups |
| GET | /api/records/ | List records with filters |
| GET | /api/records/export/csv | Export filtered records |
| POST/PUT/DELETE | /api/records/{id} | Record CRUD |
| GET | /api/job-cards/due-equipment | Equipment overdue/due soon |
| GET | /api/job-cards/search-equipment | Free-text equipment search |
| GET | /api/job-cards/ | List job cards |
| GET | /api/job-cards/{id} | Get single job card |
| POST | /api/job-cards/ | Create job card |
| PUT | /api/job-cards/{id} | Update job card |
| POST | /api/job-cards/{id}/complete | Complete → creates history |
| DELETE | /api/job-cards/{id} | Delete job card |
| GET | /api/service-history/ | List service history |
| GET | /api/service-history/{id} | Get single record |
| GET | /api/service-history/export/csv | Export history |
| POST/PUT/DELETE | /api/service-history/{id} | History CRUD |
| GET | /api/dashboard/stats | Fault analytics |
| GET | /api/service-dashboard/stats | Service KPI stats |
| POST | /api/import/preview | Preview Excel upload |
| POST | /api/import/commit | Commit Excel import |
| GET | /api/import/template | Download import template |
| GET | /api/logs/ | Audit logs with pagination |
| GET/POST/PUT/DELETE | /api/users/ | User management |

---

## 5. Core Modules

### 5.1 Dashboard

**Purpose:** High-level fault and downtime analytics.

**Features:**
- Total faults, open faults, in-progress faults by month/date range
- Downtime by plant (bar chart)
- Downtime by equipment (per plant)
- Top artisans by job count and downtime
- Fault category breakdown
- KPI cards: Total Faults, Open, Downtime

**Data source:** `maintenance_records` table

---

### 5.2 Maintenance Records

**Purpose:** Log and manage all corrective maintenance activities.

**Features:**
- Create / edit / delete records via full-screen form
- Record types: **Regular** or **Breakdown** (radio buttons)
- Filters: date range, plant, equipment group, status, type, MR No, artisan, created by, search
- Clickable rows → detail modal with inline edit
- Edit/Delete buttons inside the record modal
- CSV export of filtered records
- Bulk Excel import with validation

**Key fields:** Date, MR No, Plant, Equipment (mandatory), Issue Description, Artisan, Arrival/Finishing times, Downtime (auto-calculated), Status, Record Type, Remarks

---

### 5.3 Equipment Management

**Purpose:** Manage all plant assets and their service schedules.

**Features:**
- Plant and Equipment Group hierarchy management
- Equipment table with Manufacturer, Model No., service status badges
- Cascading plant → group → equipment navigation
- Clickable rows → Equipment Details Modal:
  - View all fields, recent service history, recent maintenance records
  - **Edit mode** — inline edit all fields
  - **Delete** — with confirmation
  - **Service** button (Zap icon) — create job card directly from equipment modal
  - **Mark Complete** button — when an active job card exists
- Recent service history rows → navigate to Service Now history modal
- Recent maintenance record rows → navigate to Records page with modal open

**Service status colours:** Purple = Overdue, Red = Due Today, Yellow = Due Soon, Green = On Schedule, Grey = Not Scheduled

---

### 5.4 Service Now (Preventive Maintenance)

**Purpose:** Execute all preventive maintenance — create job cards, track work, complete services.

**Tab 1 — Service Due / Job Cards:**
- KPI cards: Overdue (purple), Due Today (red), Due within 7 days (yellow), Open Job Cards (blue)
- Equipment Due for Service table: filter by name, plant, service status; paginated 20/page
  - **Service Now** button → create job card modal
  - **Mark Complete** button → appears when an open job card exists for that equipment
- Create Job Card for Any Equipment: plant → group → equipment cascading dropdowns
- Job Cards table: filter by search/status; paginated 20/page; clickable rows → view/edit modal
  - View mode: all job card info + print button
  - Edit mode: all fields editable inline
  - Complete form: Service Date, Performed By, Work Done (list), Parts Used (list)

**Tab 2 — Service History:**
- Filters: equipment, plant, group, service type, date range, artisan
- Paginated 50/page; Export CSV button
- Clickable rows → History Detail Modal showing all info
- Job card number in modal has a **print icon** that fetches and prints the job card PDF

**Print Job Card:**
- Opens a new browser tab with a formatted A4 HTML document
- Includes company logo, header, general info table, safety compliance box, Work To Be Done checklist, Parts Required checklist, completion record, sign-off blocks

---

### 5.5 Service Dashboard

**Purpose:** Analytics and KPI summary for service management. Read-only — no actions here.

**Features:**
- KPI cards: Overdue Services, Due Today, Due Soon, Completed This Month
- Service Status Breakdown (bar chart)
- Overdue by Plant (ranked list)
- Due Soon table (equipment due within 14 days)
- Overdue Services table

---

### 5.6 Import from Excel

**Purpose:** Bulk import historical maintenance records from Excel spreadsheets.

**Features:**
- Drag-and-drop or browse file upload (.xlsx / .xls)
- Multi-sheet support with sheet selector
- Auto-detection of column headers (flexible column name matching)
- Preview first 20 rows before committing
- Duplicate detection: updates existing records by MR No or date+equipment+issue match
- **Download Template** button — generates a pre-formatted Excel template with:
  - Column headers exactly matching expected names
  - Field descriptions row
  - 3 example rows
  - Instructions sheet

**Validation rules:**
- Date column is required
- Equipment Name is required (import rejected if any row is missing equipment)
- Record Type: accepts "regular" or "breakdown" (case-insensitive), defaults to "regular"
- Status defaults to "closed" for imported records

---

### 5.7 Reports & Export

**Purpose:** Filter and export maintenance records for compliance and management reporting.

**Features:**
- Filters: date range, plant, equipment group, status, type, MR No, artisan, created by
- Summary cards: Total Records, Open, Closed, Total Downtime
- Paginated table (50/page)
- Export to CSV (all matching records, up to 10,000 rows)

---

### 5.8 Notification Bell

**Purpose:** Always-visible real-time notifications for overdue and at-risk items.

**Location:** Fixed in the sticky header — visible on every page.

**Sections:**
| Section | Colour | Trigger |
|---------|--------|---------|
| Overdue Services | Purple | `next_service_date < today` |
| Due Today | Red | `next_service_date == today` |
| Due Soon | Yellow | `next_service_date <= today + 14d` |
| Open Job Cards | Blue | `status IN (open, in-progress)` |

**Behaviour:**
- Badge count = sum of all four sections
- Items are clickable — navigate to `/equipment` or `/service-now` with the relevant modal auto-opened
- When count > 5 in any section: individual items hidden, replaced by "More than N — click here" link to Service Now

---

### 5.9 Audit Logs (Admin Only)

**Purpose:** Full audit trail of all system mutations.

**Every create, update, delete, and import action is logged** with:
- Timestamp
- User who performed the action
- Action type (create / update / delete / import)
- Item type and ID
- Human-readable details

**Filters:** date range, user, action, item type  
**Item types:** Maintenance Record, Equipment, Equipment Group, Plant, User, Service Job Card, Service History, Parts Replacement  
**Pagination:** 50 per page  
**Export:** CSV

---

## 6. User Roles and Access

### Role Definitions

| Role | Description |
|------|-------------|
| `admin` | Full system access including user management and audit logs |
| `technician` | Standard access for maintenance staff |

### Access Matrix

| Feature | Admin | Technician |
|---------|-------|-----------|
| Dashboard | ✅ | ✅ |
| Maintenance Records (view) | ✅ | ✅ |
| Maintenance Records (create/edit) | ✅ | ✅ |
| Maintenance Records (delete) | ✅ | ✅ |
| Equipment Management | ✅ | ✅ |
| Service Now | ✅ | ✅ |
| Service Dashboard | ✅ | ✅ |
| Import from Excel | ✅ | ✅ |
| Reports | ✅ | ✅ |
| User Management | ✅ | ❌ |
| Audit Logs | ✅ | ❌ |
| Change Password | ✅ | ✅ |

### Authentication

- Credentials: username + password
- Sessions use **JWT tokens** (JSON Web Tokens) with configurable expiry (`ACCESS_TOKEN_EXPIRE_MINUTES` in `.env`)
- Tokens are stored in `localStorage` in the browser
- Every API request includes `Authorization: Bearer <token>` in the HTTP header
- A 401 response automatically clears the token and redirects to the login page
- Passwords are hashed using **bcrypt** — plaintext passwords are never stored

### Default Admin Account

The first admin account is seeded automatically on first startup using values from `.env`:
```
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=changeme123
```
**Change this password immediately after first login.**

---

## 7. How the System Works

### 7.1 Maintenance Record Lifecycle

```
Fault occurs
    │
    ▼
Technician / Supervisor creates Maintenance Record
  · Selects plant, equipment, fault description
  · Records arrival and finishing times
  · Downtime is auto-calculated
  · Sets record type: Regular or Breakdown
    │
    ▼
Record status: OPEN → IN-PROGRESS → CLOSED
    │
    ▼
Record appears in Reports, Dashboard, Export
```

### 7.2 Preventive Maintenance Lifecycle

```
Equipment is configured with service interval (days)
    │
    ▼
System calculates next_service_date = last_service_date + interval
    │
    ▼
Service status updated (live on every API call + daily at midnight):
  · next_service_date < today        → Overdue
  · next_service_date == today       → Due Today
  · next_service_date ≤ today+14d    → Due Soon
  · next_service_date > today+14d    → On Schedule
    │
    ▼
Notification bell alerts maintenance team
Service Now page lists all overdue/due-soon equipment
    │
    ▼
Technician clicks "Service Now" → creates a Service Job Card
  · Job card number auto-generated: JC-YYYYMMDD-NNNN
  · Status: Open
  · Assigned artisan + tasks + parts listed
    │
    ▼
Technician prints job card (A4 PDF via browser print)
Work is carried out in the field
    │
    ▼
Supervisor/Technician marks job card as Completed:
  · Records actual service date, work done, parts used
  · System creates a Service History record
  · Equipment last_service_date updated to service date
  · Next service date recalculated
  · Service status updated
    │
    ▼
Service history stored permanently for compliance records
```

### 7.3 Excel Import Lifecycle

```
User downloads import template (pre-formatted .xlsx)
Fills in historical data
    │
    ▼
Uploads file to Import page
    │
    ▼
System parses file:
  · Auto-detects header row (flexible column names)
  · Maps columns to fields
  · Validates: Date required, Equipment required
  · Normalises record_type (regular/breakdown)
    │
    ▼
Preview displayed (first 20 rows)
User confirms → Commit
    │
    ▼
For each row:
  · Looks up or creates: Plant, Equipment Group, Equipment
  · Checks for existing record (by MR No or date+equipment+issue)
  · Creates new record OR updates existing record
  · Status defaults to "closed"
    │
    ▼
Import summary: Created / Updated / Errors
```

### 7.4 Daily Scheduler

At **00:00 UTC every night** the APScheduler runs `recalculate_service_statuses()`:
- Queries all equipment records
- Recalculates `service_status` using today's date
- Saves any changed values to the database
- Ensures dashboard count queries (which read the stored column) are accurate without requiring a server restart

---

## 8. Deployment Architecture

### Recommended Production Setup

```
Internet
    │
    ▼
DNS  (yourdomain.com)
    │
    ▼
┌─────────────────────────────────┐
│            NGINX                │
│   (Reverse Proxy + Static)      │
│                                 │
│  /          → /var/www/dist/    │  ← Built React app (static files)
│  /api/      → localhost:8000    │  ← FastAPI backend
└──────────────────┬──────────────┘
                   │
                   ▼
┌──────────────────────────────────┐
│         FastAPI (uvicorn)         │
│         Port 8000                │
│         2 worker processes       │
│         APScheduler thread       │
└──────────────────┬───────────────┘
                   │  SQLAlchemy
                   ▼
┌──────────────────────────────────┐
│          PostgreSQL              │
│          Port 5432               │
│          maintenance_db          │
└──────────────────────────────────┘
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Serve built React frontend
    root /var/www/maintenance-app/frontend/dist;
    index index.html;
    try_files $uri $uri/ /index.html;   # SPA fallback

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

### Process Management (systemd)

Create `/etc/systemd/system/maintenance-backend.service`:

```ini
[Unit]
Description=Maintenance App FastAPI Backend
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/var/www/maintenance-app/backend
Environment="PATH=/var/www/maintenance-app/backend/venv/bin"
ExecStart=/var/www/maintenance-app/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable maintenance-backend
sudo systemctl start maintenance-backend
sudo systemctl status maintenance-backend
```

### Environment Variables (`.env`)

```env
# Database
DATABASE_URL=postgresql://maintenance_user:password@localhost:5432/maintenance_db

# Security
SECRET_KEY=minimum-32-character-random-string-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Default admin (disable after first setup)
SEED_DEFAULT_ADMIN=true
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=changeme123

# CORS — list all allowed frontend origins
CORS_ORIGINS=https://yourdomain.com
```

### Schema Migrations

**No manual migration commands are required.** On every startup:
1. `Base.metadata.create_all()` creates any missing tables
2. `ensure_schema_updates()` adds any missing columns via `ALTER TABLE`
3. `recalculate_service_statuses()` refreshes all service status values

The Alembic migration files in `alembic/versions/` serve as reference documentation only.

---

## 9. Grafana / Reporting Integration

### Overview

Grafana can connect directly to the PostgreSQL database to build live dashboards and reports without impacting the application. The database schema is stable and query-friendly.

### Recommended Grafana Data Source

```
Type:      PostgreSQL
Host:      localhost:5432  (or database server IP)
Database:  maintenance_db
User:      grafana_readonly   (create a read-only user — see below)
SSL Mode:  require (for production)
```

### Creating a Read-Only Grafana User

```sql
CREATE USER grafana_readonly WITH PASSWORD 'grafana_password';
GRANT CONNECT ON DATABASE maintenance_db TO grafana_readonly;
GRANT USAGE ON SCHEMA public TO grafana_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_readonly;
```

### Useful Dashboard Queries

**Fault count by plant and month:**
```sql
SELECT
    DATE_TRUNC('month', record_date) AS month,
    p.name AS plant,
    COUNT(*) AS fault_count
FROM maintenance_records mr
LEFT JOIN plants p ON mr.plant_id = p.id
WHERE record_date >= NOW() - INTERVAL '12 months'
GROUP BY 1, 2
ORDER BY 1, 2;
```

**Total downtime by equipment (last 30 days):**
```sql
SELECT
    e.equipment_name,
    p.name AS plant,
    SUM(mr.downtime_minutes) AS total_downtime_minutes,
    COUNT(*) AS fault_count
FROM maintenance_records mr
JOIN equipment e ON mr.equipment_id = e.id
LEFT JOIN plants p ON e.plant_id = p.id
WHERE mr.record_date >= NOW() - INTERVAL '30 days'
GROUP BY e.equipment_name, p.name
ORDER BY total_downtime_minutes DESC
LIMIT 20;
```

**Equipment service status summary:**
```sql
SELECT
    service_status,
    COUNT(*) AS equipment_count
FROM equipment
GROUP BY service_status
ORDER BY equipment_count DESC;
```

**Overdue equipment by plant:**
```sql
SELECT
    p.name AS plant,
    COUNT(e.id) AS overdue_count
FROM equipment e
JOIN plants p ON e.plant_id = p.id
WHERE e.next_service_date < CURRENT_DATE
GROUP BY p.name
ORDER BY overdue_count DESC;
```

**Open job cards by priority:**
```sql
SELECT
    priority,
    COUNT(*) AS card_count
FROM service_job_cards
WHERE status IN ('open', 'in-progress')
GROUP BY priority
ORDER BY
    CASE priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;
```

**Breakdown vs Regular records by month:**
```sql
SELECT
    DATE_TRUNC('month', record_date) AS month,
    record_type,
    COUNT(*) AS count
FROM maintenance_records
WHERE record_date >= NOW() - INTERVAL '6 months'
GROUP BY 1, 2
ORDER BY 1, 2;
```

### Grafana Alert Rules (Recommended)

| Alert | Condition | Severity |
|-------|-----------|---------|
| High overdue count | Overdue equipment > 5 | High |
| Critical job card open > 48h | `status='open' AND priority='critical' AND created_at < NOW()-INTERVAL '48h'` | Critical |
| No maintenance logged today | `COUNT(*) = 0 WHERE DATE(record_date) = CURRENT_DATE` | Warning |

---

## 10. Backup and Maintenance Plan

### 10.1 Database Backup

**PostgreSQL automated daily backup** using `pg_dump`:

Create `/etc/cron.d/maintenance-db-backup`:
```cron
0 2 * * * postgres /usr/local/bin/backup_maintenance_db.sh
```

Create `/usr/local/bin/backup_maintenance_db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/maintenance-db"
DATE=$(date +%Y%m%d_%H%M%S)
DB="maintenance_db"
USER="maintenance_user"

mkdir -p "$BACKUP_DIR"

# Full dump (plain SQL)
pg_dump -U "$USER" -F c -f "$BACKUP_DIR/${DB}_${DATE}.dump" "$DB"

# Keep only the last 30 days
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete

echo "Backup completed: ${DB}_${DATE}.dump"
```

```bash
chmod +x /usr/local/bin/backup_maintenance_db.sh
```

### 10.2 Backup Schedule

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| Full database dump | Daily at 02:00 | 30 days | /var/backups/maintenance-db |
| Weekly archive | Weekly (Sunday) | 12 weeks | Off-site / cloud storage |
| Monthly snapshot | 1st of month | 12 months | Off-site / cloud storage |

### 10.3 Restore Procedure

```bash
# Stop the application
sudo systemctl stop maintenance-backend

# Drop and recreate database
psql -U postgres -c "DROP DATABASE maintenance_db;"
psql -U postgres -c "CREATE DATABASE maintenance_db OWNER maintenance_user;"

# Restore from dump
pg_restore -U maintenance_user -d maintenance_db /var/backups/maintenance-db/maintenance_db_20260615_020000.dump

# Restart the application
sudo systemctl start maintenance-backend
```

### 10.4 Application Updates

Follow the update procedure documented in `README.md`:

1. `git pull origin main`
2. `pip install -r requirements.txt`
3. `sudo systemctl restart maintenance-backend` — schema updates apply automatically on restart
4. `npm install && npm run build` — rebuild frontend
5. Verify in browser

### 10.5 Log Monitoring

**Backend logs** (uvicorn/systemd):
```bash
sudo journalctl -u maintenance-backend -f         # Live logs
sudo journalctl -u maintenance-backend --since "1 hour ago"
```

**Nginx access logs:**
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

**PostgreSQL slow queries** (enable in `postgresql.conf`):
```
log_min_duration_statement = 1000   # Log queries > 1 second
log_line_prefix = '%t [%p]: [%l-1] '
```

### 10.6 Performance Maintenance

| Task | Frequency | Command |
|------|-----------|---------|
| VACUUM ANALYZE | Weekly | `psql -c "VACUUM ANALYZE;"` |
| Index maintenance | Monthly | `psql -c "REINDEX DATABASE maintenance_db;"` |
| Check disk usage | Weekly | `df -h` |
| Review audit logs | Monthly | Via Admin Logs page |
| Rotate old records | Quarterly | Archive records > 2 years old |

### 10.7 Security Checklist

- [ ] Change default admin password on first login
- [ ] Set `SEED_DEFAULT_ADMIN=false` after initial setup
- [ ] Use a strong `SECRET_KEY` (minimum 32 random characters)
- [ ] Enable HTTPS with a valid SSL certificate (Let's Encrypt)
- [ ] Restrict `CORS_ORIGINS` to your domain only
- [ ] Create a read-only database user for Grafana (never use the app user)
- [ ] Keep Python packages updated (`pip list --outdated`)
- [ ] Keep Node packages updated (`npm outdated`)
- [ ] Review and archive audit logs regularly
- [ ] Ensure database backups are tested by restoring to a staging environment quarterly

### 10.8 System Health Checks

**Quick health check endpoint:**
```
GET https://yourdomain.com/api/
Response: {"status": "ok", "message": "Maintenance Management API"}
```

**Database connection check:**
```bash
psql -U maintenance_user -d maintenance_db -c "SELECT COUNT(*) FROM maintenance_records;"
```

**Scheduler check** (verify daily recalculation ran):
```sql
SELECT timestamp, details
FROM audit_logs
WHERE item_type = 'system'
ORDER BY timestamp DESC
LIMIT 5;
```

---

*This documentation covers the system as of June 2026. Update this document whenever significant changes are made to the architecture, database schema, or operational procedures.*
