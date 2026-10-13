# Local Development Setup - Credential Management System

This guide explains everything required to run the project locally: the
prerequisites, how to set up the **backend** and the **frontend**, and which
host/port each part runs on. Commands are shown for **Windows / PowerShell**
(the primary dev environment); equivalents for macOS/Linux are noted where they
differ.

---

## 1. Prerequisites

Install these once before setting anything up:

| Tool            | Version           | Used by   | Check                |
| --------------- | ----------------- | --------- | -------------------- |
| **Python**      | 3.10+ (3.12 OK)   | Backend   | `python --version`   |
| **pip**         | bundled w/ Python | Backend   | `pip --version`      |
| **Node.js**     | 18+ (20/24 OK)    | Frontend  | `node --version`     |
| **npm**         | bundled w/ Node   | Frontend  | `npm --version`      |
| **Git**         | any recent        | Both      | `git --version`      |
| **Redis**       | 5+ (**optional**) | Backend   | `redis-cli ping`     |

> **Redis is optional for local development.** It backs login-attempt tracking
> and account lockout, but the backend **degrades gracefully** to the database
> when Redis is unreachable — logins still work without it.

---

## 2. Hosts & Ports

When everything is running in normal dev mode:

| Service                | URL                          | Notes                                  |
| ---------------------- | ---------------------------- | -------------------------------------- |
| **Backend API**        | `http://127.0.0.1:8000`      | Django dev server                      |
| **Django admin**       | `http://127.0.0.1:8000/admin/` | Superuser-only admin UI              |
| **Frontend (dev)**     | `http://localhost:3000`      | Next.js dev server (hot reload)        |
| **Redis** (optional)   | `127.0.0.1:6379`             | Cache / lockout store                  |

The frontend talks to the backend at `127.0.0.1:8000` (set via
`NEXT_PUBLIC_API_URL`). The backend's CORS config already allows
`http://localhost:3000` and `http://127.0.0.1:3000`, so the two cooperate out of
the box.

---

## 3. Get the Code

```powershell
git clone https://github.com/usaisoft-xray-lab/XIS-Vault-06-2026-Internal.git
cd XIS-Vault-06-2026-Internal
git checkout Feature/system-credential-page
git pull
```

The repo has two top-level apps:

```
project-credentials-management-portal/
├── backend/     # Django REST API
├── frontend/    # Next.js app
└── Docs/        # this documentation
```

---

## 4. Backend Setup (Django — runs on :8000)

### 4.1 Create & activate a virtual environment

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
```

> macOS/Linux: `python3 -m venv venv` then `source venv/bin/activate`
>
> If PowerShell blocks activation with an execution-policy error, run once:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### 4.2 Install dependencies

```powershell
pip install -r requirements.txt
```

This installs Django, DRF, SimpleJWT, django-redis, cryptography, decouple,
django-cors-headers, reportlab, and the pytest test tools.

### 4.3 Create the `.env` file

Copy the example and fill in the values:

```powershell
Copy-Item .env.example .env
```

Then generate a **Fernet encryption key** (required — secrets can't be encrypted
without it) and paste it into `.env` as `FERNET_KEY`:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Key `.env` variables:

| Variable                              | Local value / note                                   |
| ------------------------------------- | ---------------------------------------------------- |
| `SECRET_KEY`                          | any long random string                               |
| `DEBUG`                               | `True` for local development                         |
| `ALLOWED_HOSTS`                       | `localhost,127.0.0.1`                                |
| `REDIS_URL`                           | `redis://127.0.0.1:6379/0` (ignored if Redis is off) |
| `JWT_SIGNING_KEY`                     | any long random string                               |
| `FERNET_KEY`                          | **generated above — required**                       |
| `CORS_ALLOWED_ORIGINS`               | `http://localhost:3000,http://127.0.0.1:3000`        |

### 4.4 Initialize the database & create an admin user

```powershell
python manage.py migrate
python manage.py createsuperuser
```

`migrate` creates the SQLite database (`backend/db.sqlite3`).
`createsuperuser` makes an ADMIN account you can log in with.

### 4.5 Run the backend

```powershell
python manage.py runserver
```

The API is now live at **http://127.0.0.1:8000** and the admin at
**http://127.0.0.1:8000/admin/**. Keep this terminal open.

---

## 5. Frontend Setup (Next.js — runs on :3000)

Open a **second terminal** (leave the backend running).

### 5.1 Install dependencies

```powershell
cd frontend
npm install
```

### 5.2 Configure the API URL

The frontend reads the backend location from `.env.local`. It should contain:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

> This file usually already exists. If it's missing, create
> `frontend/.env.local` with the line above.

### 5.3 Run the frontend

```powershell
npm run dev
```

The app is now live at **http://localhost:3000**. It hot-reloads on file
changes. Log in with the superuser you created in step 4.4.

---

## 6. Running Order (Day-to-Day)

```
Terminal 1 (backend)              Terminal 2 (frontend)
─────────────────────             ─────────────────────
cd backend                        cd frontend
venv\Scripts\Activate.ps1         npm run dev
python manage.py runserver        → http://localhost:3000
→ http://127.0.0.1:8000
```

Open **http://localhost:3000** in the browser. The frontend calls the backend
API; the backend stores data in SQLite.

---

## 7. NPM & Django Commands Reference

**Frontend** (`frontend/`):

| Command          | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `npm run dev`    | Start the dev server (hot reload) :3000  |
| `npm run build`  | Production build → static export `out/`  |
| `npm run lint`   | Run ESLint                               |

**Backend** (`backend/`, venv active):

| Command                              | Purpose                          |
| ------------------------------------ | -------------------------------- |
| `python manage.py runserver`         | Start the API on :8000           |
| `python manage.py migrate`           | Apply database migrations        |
| `python manage.py makemigrations`    | Create migrations after model changes |
| `python manage.py createsuperuser`   | Create an admin account          |
| `pytest`                             | Run the test suite               |

---

## 8. Alternative: Single-Unit Mode (one server)

The backend can serve the **built** frontend itself — useful for a
production-like check on one port. Any non-API URL falls through to the Next.js
static export in `frontend/out/`.

```powershell
# 1. Build the frontend into frontend/out/
cd frontend
npm run build

# 2. Serve everything from Django
cd ..\backend
venv\Scripts\Activate.ps1
python manage.py runserver
```

Now **http://127.0.0.1:8000** serves both the API **and** the UI — no separate
frontend server, and CORS is a non-issue since it's one origin.

> Use **dev mode (§6)** for day-to-day work (hot reload). Use **single-unit
> mode** only to verify a production-like build.

---

## 9. Verifying the Setup

1. Backend health: open `http://127.0.0.1:8000/admin/` → the Django admin login
   should appear.
2. Frontend: open `http://localhost:3000` → the login page should appear.
3. Log in with your superuser credentials → you should land on the dashboard
   with data served from the API.
4. (Optional) `cd backend && pytest` → the test suite should pass (it uses an
   in-memory database and needs no Redis).

---

## 10. Troubleshooting

| Symptom                                              | Cause / Fix                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Login shows "Cannot reach the server"               | Backend isn't running, or `NEXT_PUBLIC_API_URL` is wrong. Start it on :8000. |
| `ImproperlyConfigured: FERNET_KEY is not set`        | Generate a Fernet key and add it to `backend/.env`.                         |
| CORS error in the browser console                    | Ensure the frontend runs on :3000 and it's in `CORS_ALLOWED_ORIGINS`.      |
| PowerShell won't activate the venv                   | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then re-activate.    |
| `Port 8000 already in use`                           | `python manage.py runserver 8001` (and update `NEXT_PUBLIC_API_URL`).      |
| `Port 3000 already in use`                           | `npm run dev -- -p 3001` (add the new origin to `CORS_ALLOWED_ORIGINS`).   |
| Account locked after failed logins                   | Wait 5 minutes, or clear the user's lockout via the Django admin.          |
| Redis connection warnings                            | Harmless — the backend falls back to the database. Start Redis to silence. |
| Changed a model but the DB didn't update             | Run `makemigrations` then `migrate`.                                       |
| Frontend `.env.local` change not picked up           | Restart `npm run dev` (env vars are read at startup).                      |

---

## 11. Summary

- **Backend** → Python venv + `pip install` + `.env` (with a Fernet key) +
  `migrate` + `createsuperuser` + `runserver` → **http://127.0.0.1:8000**.
- **Frontend** → `npm install` + `.env.local` + `npm run dev` →
  **http://localhost:3000**.
- Run both in separate terminals for daily development; Redis is optional.
- For a production-like check, `npm run build` then let Django serve everything
  from **:8000**.
