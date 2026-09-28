# Offline-First Data Synchronization System

A full-stack application enabling users to work with data offline and automatically sync with the server when the connection is restored, with built-in conflict resolution.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic v2 |
| Frontend | React 18, TypeScript, Vite, Material UI, Zustand |
| Database | MySQL 8.0 |
| Cache / Coordination | Redis 7 |
| Offline Storage | IndexedDB (via `idb`) |
| Auth | JWT (HS256) |
| Container | Docker & Docker Compose |

---

## Project Structure

```
offline-sync-system/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # auth, records, sync endpoints
│   │   ├── core/             # config, security, deps
│   │   ├── db/               # SQLAlchemy engine + Redis client
│   │   ├── models/           # ORM models (6 tables)
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # auth, record, sync business logic
│   │   └── main.py
│   ├── alembic/              # DB migrations
│   ├── tests/                # Unit tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/              # axios API layer
│   │   ├── components/       # Layout, shared components
│   │   ├── hooks/            # useNetworkStatus
│   │   ├── pages/            # Dashboard, Records, Sync History, Conflicts, Profile
│   │   ├── store/            # Zustand stores (auth + sync)
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # IndexedDB helpers
│   ├── Dockerfile
│   └── package.json
├── docker/
│   └── mysql-init.sql
├── docker-compose.yml
├── .env.example
├── postman_collection.json
└── README.md
```

---

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone <repo-url>
cd offline-sync-system
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

### 2. Start all services

```bash
docker-compose up --build
```

This starts:
- **MySQL** on port `3306`
- **Redis** on port `6379`
- **Backend API** on port `8000` — runs Alembic migrations automatically
- **Frontend** on port `5173`

### 3. Open the app

- Frontend: http://localhost:5173
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc

---

## Manual Setup (Without Docker)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your MySQL and Redis connection strings

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit VITE_API_URL if backend is not on localhost:8000
npm run dev
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles |
| `records` | Application data records with versioning |
| `local_sync_operations` | Queue of pending sync operations |
| `sync_history` | Audit log of all sync attempts |
| `conflicts` | Detected conflicts with resolution data |
| `audit_logs` | Full audit trail of record changes |

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/me` | Update profile |

### Records
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/records` | List records (search, filter, paginate) |
| POST | `/api/records` | Create record |
| GET | `/api/records/{id}` | Get single record |
| PUT | `/api/records/{id}` | Update record (with optimistic concurrency) |
| DELETE | `/api/records/{id}` | Soft-delete record |

### Sync
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sync/bulk` | Submit batch of offline operations |
| GET | `/api/sync/dashboard` | Stats overview |
| GET | `/api/sync/history` | Sync history (filterable) |
| GET | `/api/sync/conflicts` | List conflicts |
| POST | `/api/sync/conflicts/{id}/resolve` | Resolve a conflict |

---

## Offline Sync Flow

```
User Action (online/offline)
        │
        ▼
   Network check
   ┌────┴────┐
offline     online
   │           │
   ▼           ▼
Save to    Call API
IndexedDB  directly
Queue op   ──────────► Server responds
   │
   ▼
On reconnect:
   │
   ▼
Read pending ops from IndexedDB
        │
        ▼
POST /api/sync/bulk
        │
        ▼
 ┌──────┴──────┐
No conflict  Conflict detected
   │              │
Apply op     Auto: last-write-wins
   │              │
   ▼         Manual: user resolves
 synced       in Conflicts page
```

---

## Conflict Resolution Strategies

| Strategy | Behaviour |
|----------|-----------|
| `last_write_wins` | Compares client and server timestamps; most recent wins. Applied automatically. |
| `server_wins` | Server version is kept; client changes discarded. |
| `client_wins` | Client version replaces server. |
| `manual` | User provides a JSON payload that becomes the resolved state. |

Conflicts are detected when the server record's `version` is greater than the `version` in the client payload, indicating the server was modified after the client's last known state.

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v --cov=app
```

Tests cover:
- Last-write-wins logic (client newer, server newer, same timestamp)
- `create` — new record, idempotent duplicate
- `update` — no conflict, conflict with auto-resolution
- `delete` — existing record, already-deleted (idempotent)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | mysql+pymysql://... | SQLAlchemy connection string |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection string |
| `SECRET_KEY` | (change this!) | JWT signing key |
| `ALGORITHM` | HS256 | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 60 | Token TTL |
| `ENVIRONMENT` | development | `development` or `production` |
| `VITE_API_URL` | http://localhost:8000 | Frontend → backend URL |

---

## Importing the Postman Collection

1. Open Postman
2. Click **Import** → select `postman_collection.json`
3. Run **Login** first — the test script auto-saves the token
4. All other requests use `{{token}}` automatically

---

## Key Design Decisions

- **Client-generated UUIDs** — records get their ID before ever reaching the server, so offline creates can be tracked and deduplicated.
- **Idempotent sync** — each operation has a stable `id`; resubmitting the same operation is safe.
- **Optimistic concurrency** — records carry a `version` counter; mismatches trigger conflict detection rather than silent overwrites.
- **Soft deletes** — records are never physically removed (`is_deleted` flag), preserving sync history integrity.
- **Redis** — available for rate limiting, distributed locks, and caching dashboard stats in high-traffic scenarios.
