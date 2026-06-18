# Project Tech Stack & Design Reference

This document captures everything needed to build a new project for the same company using the same standards.

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.2 | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 5.1 | Build tool & dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| React Router | 6.22 | Client-side routing |
| Recharts | 2.12 | Charts and data visualisation |
| Lucide React | 0.323 | Icon library |
| Axios | 1.6 | HTTP client |
| date-fns | 3.3 | Date formatting and manipulation |
| jsPDF | 4.2 | PDF generation |
| jspdf-autotable | 5.0 | PDF table generation |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.x | Runtime |
| FastAPI | 0.109 | REST API framework |
| Uvicorn | 0.27 | ASGI server |
| SQLAlchemy | 2.0 | ORM |
| Alembic | 1.13 | Database migrations |
| PostgreSQL | 15 | Primary database |
| psycopg2 | 2.9 | PostgreSQL driver |
| Pydantic | 2.13 | Data validation and schemas |
| python-jose | 3.3 | JWT authentication |
| passlib / bcrypt | 1.7 / 4.0 | Password hashing |
| pandas / openpyxl | 3.0 / 3.1 | Excel import |
| APScheduler | 3.10 | Background scheduled jobs |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker | Containerisation |
| Docker Compose | Multi-container orchestration |
| PostgreSQL 15 Alpine | Database container |
| Nginx | Frontend static file serving (production) |
| Grafana | Optional monitoring dashboard |

---

## Project Structure

```
project-root/
├── frontend/               # React + TypeScript app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (auth, etc.)
│   │   ├── pages/          # Page-level components
│   │   ├── services/       # API call functions (api.ts)
│   │   ├── types/          # TypeScript interfaces (index.ts)
│   │   └── index.css       # Global styles and Tailwind components
│   ├── public/             # Static assets (logo, favicon)
│   └── index.html
├── backend/
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   ├── main.py         # App entry point, startup seeds
│   │   ├── database.py     # DB session and engine
│   │   ├── security.py     # JWT and password hashing
│   │   └── config.py       # Settings from .env
│   ├── requirements.txt
│   └── .env                # Environment variables (never commit)
├── docker-compose.yml
├── docker-compose.prod.yml
└── STACK.md
```

---

## Colour Palette

| Name | Hex | Usage |
|---|---|---|
| **Brand Green** | `#00b450` | Primary buttons, active nav links, active sub-links |
| **Brand Green Dark** | `#009940` | Primary button hover state |
| **Page Background** | `#f3f4f6` (gray-100) | App background, sidebar, login page |
| **Card Background** | `#ffffff` | Cards, modals, table containers |
| **Border** | `#e5e7eb` (gray-200) | Card borders, dividers, sidebar border |
| **Text Primary** | `#111827` (gray-900) | Headings, important text |
| **Text Secondary** | `#374151` (gray-700) | Body text, table cells |
| **Text Muted** | `#6b7280` (gray-500) | Labels, subtitles, placeholder hints |
| **Text Disabled** | `#9ca3af` (gray-400) | Disabled states, empty states |

### Status / Badge Colours
| Status | Background | Text |
|---|---|---|
| Success / Active / Closed | `bg-green-100` | `text-green-800` |
| Warning / Due Soon / In Progress | `bg-yellow-100` | `text-yellow-800` |
| Danger / Overdue / Open | `bg-red-100` | `text-red-800` |
| Due Today | `bg-orange-100` | `text-orange-800` |
| Info / Equipment | `bg-blue-100` | `text-blue-800` |
| Component / Purple | `bg-purple-100` | `text-purple-800` |
| Neutral / Inactive | `bg-gray-100` | `text-gray-600` |

---

## UI Design Rules

### Layout
- Fixed sidebar: `w-60` (240px), `bg-gray-100`, `border-r border-gray-200`
- Main content: `ml-60`, `p-6`, `bg-gray-100`
- Sticky top header: `bg-white`, `border-b border-gray-200`, `px-6 py-3`
- Page content uses `space-y-6` for vertical rhythm

### Cards
```css
.card — bg-white rounded-xl shadow-sm border border-gray-200 p-6
```
- All content sections sit inside cards
- Modals use the same card style with `max-w-*` width constraints
- Modal backdrop: `fixed inset-0 z-50 bg-black/50`
- Modals are scrollable: `overflow-y-auto`, content `my-8`

### Buttons
```css
.btn-primary  — #00b450 background, white text, hover #009940
.btn-secondary — white background, gray-700 text, gray border
.btn-danger   — red-600 background, white text
.btn-sm       — px-3 py-1.5 text-xs (smaller variant)
```

### Forms / Inputs
```css
.input  — rounded-lg border-gray-300 px-3 py-2 text-sm, focus ring blue-500
.label  — text-sm font-medium text-gray-700 mb-1
```
- Form grids use `grid gap-4 lg:grid-cols-5` for large forms (5 columns)
- Full-width rows use `lg:col-span-5`
- Add forms open in modals (`max-w-5xl`), not inline

### Tables
```css
.table-container — overflow-x-auto rounded-xl border border-gray-200
.table           — min-w-full divide-y divide-gray-200
thead            — bg-gray-50
th               — px-4 py-3 text-xs font-semibold text-gray-500 uppercase
td               — px-4 py-3 text-sm text-gray-700 whitespace-nowrap
tbody tr         — hover:bg-gray-50, border-b border-gray-100
```
- Clickable rows use `cursor-pointer hover:bg-blue-50/50`
- Clicking a row opens a detail modal

### Badges
```css
.badge — inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
```

### Modals
- Overlay: `fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto`
- Content box: `card w-full max-w-{size} my-8`
- Click outside to close (backdrop onClick)
- Header: flex row with title left, action icons + X close right
- Action icons (edit/delete): `p-1.5 rounded text-gray-400 hover:text-{color}-600`

### Sidebar Navigation
- Background: `bg-gray-100`
- Border right: `border-r border-gray-200`
- Logo area: `h-16`, centered
- Group headers (collapsed): `text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded-lg`
- Group headers (active child): `text-gray-900 bg-gray-200`
- Sub-links (active): `#00b450` background, `text-white`, `rounded-lg`
- Sub-links (inactive): `text-gray-500 hover:text-gray-900 hover:bg-gray-200`
- Standalone links (active): `#00b450` background, `text-white`
- Standalone links (inactive): `text-gray-600 hover:bg-gray-200 hover:text-gray-900`
- User footer: name `text-gray-900`, role `text-gray-500`, logout icon button

### Icons
- Library: **Lucide React**
- Standard size: `h-4 w-4`
- Small (in badges/buttons): `h-3.5 w-3.5`
- Large (page icons): `h-5 w-5` or `h-6 w-6`

---

## Authentication & Roles

JWT-based authentication. Token stored in `localStorage`. Expires after 480 minutes (8 hours).

| Role | Access |
|---|---|
| `admin` | Full access including Users, Audit Logs |
| `general` | Full access except Users and Audit Logs |
| `viewer` | Read-only — no create/edit/delete/service actions, no Import |

### Protected Routes
```tsx
<ProtectedRoute>          // Must be logged in
<ProtectedRoute adminOnly> // Admin only
<ProtectedRoute generalOnly> // General + Viewer (not admin)
<ProtectedRoute noViewer>  // Admin + General (not viewer)
```

### Special Accounts
- **Administrator** — protected system account, password-only editable via UI
- **Backdoor** — hidden recovery account, never visible in users list, password stored in `BACKDOOR_PASSWORD` env variable

---

## Environment Variables

```env
# backend/.env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=your-jwt-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
SEED_DEFAULT_ADMIN=true
DEFAULT_ADMIN_USERNAME=admin@example.com
DEFAULT_ADMIN_PASSWORD=yourpassword
BACKDOOR_PASSWORD=your-backdoor-password
```

---

## API Conventions

- Base URL: `/api`
- Auth: `Bearer <token>` in `Authorization` header
- All list endpoints return `{ total: number, items: [] }` pattern
- Pagination via `skip` and `limit` query params
- Dates: ISO string `YYYY-MM-DD`
- Errors: `{ detail: "message" }` from FastAPI

---

## PDF Generation

Uses `jsPDF` + `jspdf-autotable` on the frontend.

Standard pattern:
1. Fetch all records (limit 1000)
2. Load logo from `/logo-new.png` as base64
3. Add logo at top (`x=14, y=10, w=60, h=22`)
4. Add title and metadata below logo
5. Use `autoTable` with `headStyles: { fillColor: [0, 180, 80] }` (brand green)
6. Save as `filename.pdf`

---

## Docker

```yaml
services:
  postgres:   # PostgreSQL 15 Alpine
  backend:    # FastAPI on port 8000
  frontend:   # Nginx serving built React on port 3000
  grafana:    # Optional monitoring on port 3001
```

**Safe update commands (data preserved):**
```bash
docker-compose down
docker-compose up --build
```

**Wipes all data (destructive):**
```bash
docker-compose down -v
```

**Reset a password directly in DB:**
```bash
docker exec -it maintenance_backend python -c "
from app.database import SessionLocal
from app.models.user import User
from app.security import get_password_hash
db = SessionLocal()
u = db.query(User).filter(User.full_name == 'Administrator').first()
u.hashed_password = get_password_hash('newpassword')
db.commit()
db.close()
"
```
