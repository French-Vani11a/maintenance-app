
######## to clear all test data --> docker compose --env-file .env.prod -f docker-compose.prod.yml down -v

# Maintenance Management System

A full-stack web application for tracking plant maintenance faults, downtime, equipment, and artisan activity.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| Backend | FastAPI + SQLAlchemy + Alembic |
| Database | PostgreSQL 15 |
| Auth | JWT (python-jose + passlib bcrypt) |
| Excel Import | pandas + openpyxl |
| Dashboards | Grafana (optional, port 3001) |

## Features

- **Dashboard** – total faults, open vs closed, downtime hours, top faulty equipment, faults by day, downtime by plant, top artisans
- **Maintenance Records** – searchable/filterable table, add/edit/delete, status tracking
- **Equipment Management** – equipment list per plant, active/inactive status
- **Import** – upload Excel file → preview rows → save to PostgreSQL
- **Reports** – export to CSV / Excel with date range filters
- **Grafana** – connect directly to PostgreSQL for live dashboards

## Quick Start (Docker)

```bash
# 1. Copy environment file
cp .env.example backend/.env

# 2. Start all services
docker-compose up -d

# 3. Open the app
# Web app:  http://localhost:3000
# API docs: http://localhost:8000/docs
# Grafana:  http://localhost:3001  (admin / admin123)

# Default login
# Username: admin
# Password: admin123
```

## Production Deployment on Windows Server (Docker)

Use this section if you want to host the full application on your own Windows server with Docker.

### What runs in production

The production stack is defined in `docker-compose.prod.yml` and contains:

- `postgres` – PostgreSQL database for all live records
- `backend` – FastAPI API service
- `frontend` – Nginx container serving the built React frontend and proxying `/api` requests to the backend
- `grafana` – optional monitoring service

In live use, the request flow is:

1. User opens the frontend in the browser
2. The frontend container serves the React app
3. Browser requests to `/api/...` are forwarded by Nginx to the backend container
4. The backend reads/writes data in PostgreSQL

### 1) Prepare the Windows server

Install these on the server:

1. Docker Desktop
2. Git
3. Optional but recommended: IIS or another reverse proxy if you want HTTPS on ports 80/443

In Docker Desktop, make sure:

1. Linux containers are enabled
2. Docker is running before you start deployment

If Windows Firewall is enabled, allow the ports you plan to use:

1. `3000` for direct access testing
2. `80` and `443` if you will use IIS or another reverse proxy in front of Docker

### 2) Copy the project onto the server

Open PowerShell and run:

```powershell
git clone YOUR_REPO_URL C:\maintenance-app
cd C:\maintenance-app
```

If the project is already on the server, open PowerShell in the project folder:

```powershell
cd C:\maintenance-app
```

### 3) Create the production environment files

Create the root compose env file and the backend env file:

```powershell
Copy-Item .env.prod.example .env.prod
Copy-Item .env.prod.example backend\.env
```

You must edit both files before starting the application.

### 4) Configure the environment values

Edit `.env.prod` and `backend/.env` and set the values below.

Database settings:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Backend settings:

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

Access control:

- `CORS_ORIGINS`

Admin seed settings:

- `SEED_DEFAULT_ADMIN`
- `DEFAULT_ADMIN_USERNAME`
- `DEFAULT_ADMIN_PASSWORD`

Important rules:

1. `DATABASE_URL` must match the same database name, username, and password used in `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`
2. `SECRET_KEY` must be replaced with a long random secret before going live
3. `DEFAULT_ADMIN_PASSWORD` must be changed from the example value before first startup
4. `CORS_ORIGINS` should contain your real site URL, for example `https://your-domain.com`

### 5) Understand frontend and backend exposure

Frontend:

1. The React app is built by `frontend/Dockerfile`
2. The built files are served by Nginx inside the `frontend` container
3. Nginx proxies `/api/` requests to the `backend` service using `frontend/nginx.conf`

Backend:

1. FastAPI is built from `backend/Dockerfile`
2. It runs inside the `backend` container on port `8000`
3. It is not meant to be accessed directly by the public internet in the production setup

Current production network behavior:

1. The frontend is published on `127.0.0.1:3000`
2. That means it is available on the server itself, but not remotely from other machines unless you change the port binding or place a reverse proxy in front of it

### 6) Remove the existing test data before go-live

If you used the app with test records before deployment, remove the PostgreSQL volume before your real launch.

Run this from `C:\maintenance-app`:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
```

What this does:

1. Stops the running production containers
2. Deletes the PostgreSQL volume used by this stack
3. Permanently removes the old database data

This is the correct step if you want live deployment to start with an empty database.

### 7) Start the full production stack

Run:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

What happens during startup:

1. PostgreSQL starts first
2. Backend starts and connects to the database
3. Frontend starts and serves the React production build
4. If `SEED_DEFAULT_ADMIN=true`, the backend creates the initial admin account if it does not already exist

### 8) Run database migrations

After the stack starts, apply any pending database schema changes using Alembic:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend alembic upgrade head
```

This ensures the database schema is up to date with the latest migrations.

### 9) Verify that frontend, backend, and database are running

Check container status:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

Check backend logs:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
```

Check frontend logs:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f frontend
```

Check database logs:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f postgres
```

### 10) Open the application

With the current production file, you can test on the Windows server itself at:

- `http://localhost:3000`

If you want other devices to access it directly without IIS or another reverse proxy, update the frontend port binding in `docker-compose.prod.yml`.

Change this:

```yaml
ports:
   - "127.0.0.1:3000:80"
```

To this:

```yaml
ports:
   - "3000:80"
```

Then restart the stack:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

After that, the app can be reached from another machine using:

- `http://YOUR_SERVER_IP:3000`

### 11) Recommended public production setup on Windows

For a real public deployment, the safer pattern is:

1. Keep Docker frontend bound to `127.0.0.1:3000`
2. Use IIS, Caddy, or another reverse proxy on the Windows host
3. Publish the site on `80` and `443`
4. Forward traffic from the reverse proxy to `http://127.0.0.1:3000`
5. Terminate HTTPS at the reverse proxy

That gives you:

1. One public entry point
2. HTTPS support
3. No need to expose backend or database ports directly

### 12) First login after deployment

If `SEED_DEFAULT_ADMIN=true`, log in using:

1. `DEFAULT_ADMIN_USERNAME`
2. `DEFAULT_ADMIN_PASSWORD`

Change that password immediately after the first login.

### 13) Updating the live server later

When you change the code and want to redeploy:

```powershell
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

If the update includes database schema changes, run migrations again:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 14) Useful recovery checks

If the app does not open:

1. Confirm Docker Desktop is running
2. Check `docker compose ... ps`
3. Check frontend logs

If the frontend opens but login or data loading fails:

1. Check backend logs
2. Confirm `backend/.env` has the correct `DATABASE_URL`
3. Confirm `CORS_ORIGINS` matches your actual site URL

If the backend fails to start:

1. Check whether the database credentials in `.env.prod` and `backend/.env` match
2. Check postgres logs

### 15) Important note about data

Your live data is stored in the Docker PostgreSQL volume. It will survive normal restarts, but it will be deleted if you run:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
```

Only use that command when you intentionally want to remove the database, such as before first go-live or during a planned reset.

### 16) Windows IIS reverse proxy with HTTPS

Use this option if you want the app to be available on a real domain over `https://`.

#### Step A: Keep Docker on localhost

Do not expose Docker directly to the internet. Keep the frontend binding in `docker-compose.prod.yml` as:

```yaml
ports:
   - "127.0.0.1:3000:80"
```

That means Docker serves the app only on the Windows server itself, and IIS becomes the public entry point.

#### Step B: Install IIS components

Open PowerShell as Administrator and run:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All
Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpRedirect -All
Enable-WindowsOptionalFeature -Online -FeatureName IIS-ManagementConsole -All
```

Then install these IIS modules if they are not already installed:

1. URL Rewrite
2. Application Request Routing (ARR)

After installing ARR:

1. Open IIS Manager
2. Click the server node
3. Open `Application Request Routing Cache`
4. Click `Server Proxy Settings`
5. Enable `Proxy`

#### Step C: Create the IIS website

1. Open IIS Manager
2. Create a new site or use `Default Web Site`
3. Bind it to your domain name on port `80`
4. Point the site path to any simple folder on disk, for example `C:\inetpub\maintenance-app`

The folder content is not important here because IIS will proxy all requests to Docker.

#### Step D: Add reverse proxy rule

Open the site in IIS Manager and create a URL Rewrite inbound rule:

1. Match URL: `(.*)`
2. Action type: `Rewrite`
3. Rewrite URL: `http://127.0.0.1:3000/{R:1}`
4. Preserve query string: enabled

This forwards all site traffic to the frontend container.

#### Step E: Add HTTPS certificate

In IIS:

1. Open `Server Certificates`
2. Import or create a certificate for your domain
3. Add an HTTPS binding on port `443`
4. Select the certificate

Then optionally redirect HTTP to HTTPS using URL Rewrite or an IIS redirect rule.

#### Step F: Final checks

1. Confirm Docker app is reachable locally at `http://127.0.0.1:3000`
2. Confirm your DNS points the domain to the Windows server IP
3. Open `https://your-domain.com`
4. Test login, records listing, and dashboard loading

### 17) Direct public hosting on port 3000

Use this only if you want the fastest setup and do not need IIS in front immediately.

#### Step A: Expose the frontend publicly

Edit `docker-compose.prod.yml` and change the frontend service port binding from:

```yaml
ports:
   - "127.0.0.1:3000:80"
```

to:

```yaml
ports:
   - "3000:80"
```

#### Step B: Restart the application

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

#### Step C: Open Windows Firewall

Open PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "Maintenance App 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

#### Step D: Test from another machine

Open:

- `http://YOUR_SERVER_IP:3000`

Notes:

1. This is simpler but does not give you HTTPS by default
2. This is acceptable for internal/private network access
3. For public internet access, IIS or another reverse proxy with HTTPS is the better setup

### 18) PostgreSQL backup and restore on Windows Docker

Use these commands to protect live data before upgrades or major changes.

#### Step A: Create a backup folder on Windows

```powershell
New-Item -ItemType Directory -Force -Path C:\maintenance-backups
```

#### Step B: Create a database backup

Run this from `C:\maintenance-app`:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_dump -U maintenance_user -d maintenance_db > C:\maintenance-backups\maintenance_db_backup.sql
```

If your database name or user is different, replace `maintenance_db` and `maintenance_user` with the values from `.env.prod`.

#### Step C: Restore a backup into a fresh database

Warning: this overwrites the target database contents if you reset and restore into the same environment.

1. Stop and remove the current stack data if you want a clean restore:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

2. Wait for postgres to become ready

3. Restore the SQL dump:

```powershell
Get-Content C:\maintenance-backups\maintenance_db_backup.sql | docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres psql -U maintenance_user -d maintenance_db
```

#### Step D: Verify restored data

1. Log into the application and check records
2. Or inspect the database directly:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres psql -U maintenance_user -d maintenance_db
```

Inside PostgreSQL, you can run:

```sql
\dt
SELECT COUNT(*) FROM maintenance_records;
```

#### Step E: Recommended backup practice

1. Take a backup before every deployment
2. Keep dated backup files outside Docker volumes
3. Test restore at least once before relying on the backup process in production

## Local Development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt

# Set up PostgreSQL then:
cp ../.env.example .env    # edit DATABASE_URL

uvicorn app.main:app --reload
# API at http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App at http://localhost:5173
```

## Database Schema

```
plants               equipment              users
─────────────        ─────────────────      ─────────────
id                   id                     id
name                 plant_id (FK)          full_name
                     equipment_name         username
                     equipment_code         hashed_password
                     status                 role

maintenance_records              fault_categories
───────────────────────────      ────────────────
id                               id
record_date                      name
time_reported
reporter_name / reported_to
artisan_name
mr_no
plant_id (FK) / equipment_id (FK)
issue_description
arrival_time / finishing_time
downtime_minutes
remarks
status  (open | in-progress | closed)
fault_category_id (FK)
created_at / updated_at
```

## Grafana Setup

1. Open Grafana at http://localhost:3001
2. Add PostgreSQL datasource:
   - Host: `postgres:5432`
   - Database: `maintenance_db`
   - User: `postgres` / Password: `postgres123`
3. Build dashboards with SQL queries against `maintenance_records`

## Excel Import Format

The importer auto-detects column headers. Supported column names:

| Field | Accepted Headers |
|-------|-----------------|
| Date | date, record date |
| Time Reported | time reported, time |
| Reporter | reported by, reporter |
| Artisan | artisan, artisan name, technician |
| MR No | mr no, mr#, mr number |
| Plant | plant, department |
| Equipment | equipment, machine, asset |
| Fault | fault description, issue, description, comment, comments |
| Arrival Time | arrival time, arrived |
| Finishing Time | finishing time, finish time |
| Downtime | downtime, down time |
| Remarks | remarks, notes, observation |