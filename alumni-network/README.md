# Alumni Network

This is the TechDemocracy Alumni Portal, embedded as a linked sibling app inside
`cotelligent-hrms`. It is **unmodified** from the standalone project other than:
- `backend/.env` — points at its own database (`alumni_network`, separate from
  HRMS's `dev-hr`) and a freshly generated `AUTH_SECRET`.
- `frontend/vite.config.js` — dev server pinned to port `5174`, proxy target
  pinned to the backend on port `8010`.

It's reached from HRMS via the **Alumni** tile on `/modules` (`HRModulePage.jsx`),
which opens `VITE_ALUMNI_NETWORK_URL` (see `frontend/.env` in the HRMS app,
defaults to `http://localhost:5174`) in a new tab.

## Why a separate app instead of a merged module

Alumni's frontend calls `fetch("/api/...")` directly in 50+ files (no central
API client) and its own identity system (`users`/`staff_users`) is unrelated to
HRMS's `employees` table — an alumnus is by definition not a current employee.
Keeping it as its own app avoids `/api` path collisions with HRMS, avoids
React Router/Tailwind-token conflicts between the two design systems, and
keeps 100% functional fidelity with the original project.

## One-time setup

```bash
# Database (Postgres, same server as HRMS)
createdb alumni_network   # or: psql -U postgres -c "CREATE DATABASE alumni_network;"

# Backend
cd alumni-network/backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # already done in this checkout

# Frontend
cd ../frontend
npm install                                       # already done in this checkout
```

Tables and demo seed data are created automatically the first time the backend
starts (`ensure_schema()` in `core/db.py`) — nothing to migrate by hand.

## Running

Included in the repo's `start.sh` — one command brings up all four processes
(HRMS backend/frontend + Alumni backend/frontend). To run just this app:

```bash
# Terminal 1
cd alumni-network/backend && ./venv/Scripts/uvicorn main:app --reload --port 8010

# Terminal 2
cd alumni-network/frontend && npm run dev   # http://localhost:5174
```

## Demo logins

| Role   | Email                      | Password              |
|--------|-----------------------------|------------------------|
| Alumni | demo.alumni@example.com     | Alumni#Demo2026        |
| HR     | demo.hr@example.com         | HRPortal#Demo2026       |
| Admin  | demo.admin@example.com      | AdminConsole#2026       |

## Not in scope (yet)

- Single sign-on with HRMS — this app has its own login, independent of the
  HRMS session.
- Production reverse-proxy config to serve both apps under one domain/port —
  this setup is for local dev with distinct ports.
