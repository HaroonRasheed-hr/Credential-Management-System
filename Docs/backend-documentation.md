# Backend Documentation — Credential Management System

This document describes the backend of the Credentials Management Portal: the
technologies used, how the system is structured, and everything that has been
implemented — from the folder layout to security, the data models, and the
API.

---

## 1. Overview

The backend is a **Django REST API** that stores projects and their associated
secrets (environment variables, license keys, admin credentials, app users),
manages teams and users, records an audit trail of every action, sends in-app
notifications, and generates PDF activity reports.

All sensitive values are **encrypted at rest**, access is controlled with
**JWT authentication** plus **role-based permissions**, and the same Django
process can also serve the compiled Next.js frontend as a single deployable
unit.

---

## 2. Technology Stack

| Layer                | Technology                              | Purpose                                                        |
| -------------------- | --------------------------------------- | -------------------------------------------------------------- |
| Language             | Python 3.10+                            | Backend runtime                                                |
| Web framework        | Django 4.2                              | ORM, routing, admin, settings                                  |
| API framework        | Django REST Framework (DRF)             | Serializers, views, pagination, throttling                     |
| Authentication       | `djangorestframework-simplejwt`         | JWT access/refresh tokens + token blacklist                    |
| Cache / lockout store| Redis via `django-redis`               | Login-attempt tracking, lockout, rate-limit backing            |
| Encryption           | `cryptography` (Fernet)                 | Symmetric encryption of secrets at rest                        |
| Config               | `python-decouple`                       | Reads settings from `.env`                                     |
| CORS                 | `django-cors-headers`                   | Allows the frontend origin to call the API                     |
| PDF reports          | `reportlab`                             | Generates branded activity-report PDFs                         |
| Database             | SQLite (`db.sqlite3`)                   | Default datastore (swappable for Postgres in production)       |
| Testing              | `pytest`, `pytest-django`, `factory-boy`| Unit and endpoint tests                                        |

Dependencies are declared in [requirements.txt](../backend/requirements.txt)
and split into [requirements/base.txt](../backend/requirements/base.txt)
(production) and [requirements/dev.txt](../backend/requirements/dev.txt)
(testing tools).

---

## 3. Architecture

### Layered design

The codebase follows a clean, layered structure so that business rules live
apart from HTTP handling:

```
Request → Middleware → URLconf → View → Serializer → Service → Model → Database
                                   ↓
                          Standard JSON envelope
```

- **Middleware** — request logging, login-lockout fast path, JWT decoding.
- **Views** (`views.py`) — thin HTTP handlers; validate input, call services,
  return a consistent envelope.
- **Serializers** (`serializers.py`) — validation, encryption/decryption, and
  field masking.
- **Services** (`services.py`) — business logic (authentication, project
  visibility, notifications, PDF generation).
- **Permissions** (`permissions.py`) — role/membership authorization checks.
- **Models** (`models.py`) — database schema via the Django ORM.

### Request lifecycle

1. `RequestLoggerMiddleware` logs the method, path, user, IP, and a
   **sanitized** body (passwords/tokens are replaced with `***`).
2. `LoginAttemptMiddleware` short-circuits login requests for locked accounts
   with `423 Locked` before the view runs.
3. `JWTAuthMiddleware` cheaply decodes the JWT payload and attaches
   `request.user` / `request.role` for non-DRF code.
4. DRF's `JWTAuthentication` performs the **authoritative** token check
   (signature, expiry, blacklist) on every API view.
5. The view validates with a serializer, delegates to a service, and returns a
   response wrapped in the standard envelope.

### Standard response envelope

Every endpoint returns a consistent shape (see
[utils/responses.py](../backend/utils/responses.py)):

```jsonc
// success
{ "success": true, "message": "…", "data": { … } }

// error
{ "success": false, "message": "…", "code": "…", "errors": { … } }
```

A custom DRF exception handler wraps framework errors in the same format.

---

## 4. Complete Folder Structure

```
backend/
├── apps/                          # All domain applications
│   ├── activity_log/              # Audit trail of every action
│   │   ├── models.py              #   ActivityLog (denormalized project_name)
│   │   ├── serializers.py
│   │   ├── views.py               #   Per-project activity list
│   │   ├── admin.py
│   │   └── tests/test_retention.py
│   ├── admin_credentials/         # Admin-panel logins per project (encrypted)
│   │   ├── models.py · serializers.py · views.py · admin.py
│   ├── app_users/                 # End-user accounts of a project (encrypted)
│   │   ├── models.py · serializers.py · views.py · admin.py
│   ├── authentication/            # Login / refresh / logout / me + lockout
│   │   ├── services.py            #   AuthService (JWT issue, lockout logic)
│   │   ├── serializers.py · views.py · urls.py
│   │   ├── permissions.py · validators.py
│   │   └── tests/                 #   login, lockout, endpoint tests
│   ├── device_credentials/        # System-wide device credentials (Admin-managed)
│   │   ├── models.py              #   DeviceCredential, ProjectDevice
│   │   ├── serializers.py · views.py · permissions.py · urls.py
│   ├── env_variables/             # Project env vars + file attachments (encrypted)
│   │   ├── models.py · serializers.py · views.py · admin.py
│   ├── environment_credentials/   # Per-project Dev/Deployment system credentials
│   │   ├── models.py              #   EnvironmentCredential (unique per project+type)
│   │   ├── serializers.py · views.py · signals.py · urls.py
│   ├── license_keys/              # License keys per project (encrypted)
│   │   ├── models.py · serializers.py · views.py · admin.py
│   ├── notifications/             # In-app notifications (upward visibility)
│   │   ├── models.py · serializers.py · views.py · urls.py
│   │   ├── services.py            #   NotificationService (fan-out by role)
│   │   └── tests/test_views.py
│   ├── projects/                  # Core project domain + shared utilities
│   │   ├── models.py              #   Project, ProjectMember
│   │   ├── encryption.py          #   EncryptionService (Fernet)
│   │   ├── services.py            #   ProjectService (visibility, members, logging)
│   │   ├── permissions.py         #   IsProjectMember / IsProjectAdmin / CanDelete…
│   │   ├── serializers.py · views.py · validators.py · signals.py · urls.py
│   │   └── tests/test_projects.py
│   ├── reports/                   # PDF activity reports + recent activity feed
│   │   ├── services.py            #   reportlab PDF builder
│   │   ├── views.py · urls.py
│   ├── settings_profile/          # Profile + change-password (no new model)
│   │   ├── serializers.py · views.py · urls.py · validators.py
│   │   └── tests/
│   ├── teams/                     # Teams + team members
│   │   ├── models.py              #   Team, TeamMember
│   │   ├── serializers.py · views.py · permissions.py · urls.py · admin.py
│   └── users/                     # Custom User model (auth root)
│       ├── models.py              #   User (UUID PK, role, lockout fields)
│       ├── managers.py            #   UserManager (create_user/superuser)
│       └── admin.py
│
├── config/                        # Project configuration
│   ├── settings/
│   │   ├── base.py                #   Main settings (apps, DRF, JWT, Redis, CORS, logging)
│   │   └── test.py                #   In-memory DB + LocMem cache for tests
│   ├── urls.py                    #   Root URLconf + frontend catch-all
│   ├── wsgi.py · asgi.py
│
├── middleware/                    # Custom middleware
│   ├── request_logger.py          #   Logs requests with sensitive-field masking
│   ├── login_attempt.py           #   Fast-path lockout guard (423)
│   └── jwt_auth.py                #   Attaches request.user from JWT claims
│
├── utils/                         # Cross-cutting helpers
│   ├── responses.py               #   success/error/paginated envelopes + exc handler
│   ├── throttle.py                #   Per-process rate throttles (LocMem)
│   └── frontend.py                #   Serves the Next.js static export
│
├── requirements/                  # Split dependency files
│   ├── base.txt · dev.txt
├── requirements.txt               # Combined dependency list
├── logs/                          # Runtime log output (django.txt)
├── manage.py                      # Django entry point
├── db.sqlite3                     # SQLite database
├── .env / .env.example            # Environment configuration
└── .gitignore
```

> Each app also contains the standard `__init__.py`, `apps.py`, and a
> `migrations/` directory (omitted above for brevity).

---

## 5. Configuration

Settings live in [config/settings/base.py](../backend/config/settings/base.py)
and read secrets from `.env` via `python-decouple`. Key environment variables
(see [.env.example](../backend/.env.example)):

| Variable                              | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| `SECRET_KEY`                          | Django secret key                               |
| `DEBUG`                               | Debug toggle (default `False`)                  |
| `ALLOWED_HOSTS`                       | Comma-separated allowed hosts                   |
| `REDIS_URL`                           | Redis connection for cache / lockout            |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`   | Access-token lifetime (default 60)              |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS`     | Refresh-token lifetime (default 7)              |
| `JWT_SIGNING_KEY`                     | JWT signing key                                 |
| `FERNET_KEY`                          | 32-byte base64 key used to encrypt all secrets  |
| `CORS_ALLOWED_ORIGINS`                | Frontend origins permitted to call the API      |

**Redis** is configured to **degrade gracefully**: short socket timeouts and
`IGNORE_EXCEPTIONS=True` mean an unavailable Redis never stalls a request — the
lockout logic falls back to the database.

---

## 6. Data Models

All models use **UUID primary keys** and `created_at` / `updated_at`
timestamps. The custom `User` model is the auth root (`AUTH_USER_MODEL =
users.User`).

| Model              | App                | Key fields                                                                 |
| ------------------ | ------------------ | -------------------------------------------------------------------------- |
| `User`             | users              | email (login), username, `role` (ADMIN/DEVELOPER), lockout & login metadata |
| `Project`          | projects           | name, slug (auto), description, `password` (encrypted), status, created_by  |
| `ProjectMember`    | projects           | project + user + role (ADMIN/DEVELOPER), unique per (project, user)         |
| `Team`             | teams              | name, team_type (AI_RESEARCH/ENGINEERING/ADMIN), created_by                |
| `TeamMember`       | teams              | team + user + role, optional stored password                               |
| `EnvVariable`      | env_variables      | key, **encrypted** value, environment (DEV/STAGING/PROD), optional encrypted file |
| `LicenseKey`       | license_keys       | license_name, **encrypted** key, vendor, expiry_date                       |
| `AdminCredential`  | admin_credentials  | admin_panel_url, username, **encrypted** password, notes                   |
| `AppUser`          | app_users          | username, email (optional), **encrypted** password_or_token, role_in_app   |
| `DeviceCredential` | device_credentials | device_name, device_ip, rustdesk_ip, **encrypted** rustdesk/sudo/device passwords, created_by |
| `ProjectDevice`    | device_credentials | project_id (UUID), device FK — links a device to a project                |
| `EnvironmentCredential` | environment_credentials | project, environment_type (DEVELOPMENT/DEPLOYMENT), system_name, system_ip, **encrypted** admin/rustdesk passwords |
| `ActivityLog`      | activity_log       | project (+ denormalized `project_name`), user, action, module, description |
| `Notification`     | notifications      | recipient, sender, title, message, module, is_read                         |

**Audit-trail durability:** `ActivityLog` keeps a denormalized `project_name`
captured at write time, so logs stay meaningful even after a project is deleted
(the FK is nulled, not cascaded).

---

## 7. Security

### Encryption at rest

[apps/projects/encryption.py](../backend/apps/projects/encryption.py) provides
`EncryptionService`, a Fernet (AES-128-CBC + HMAC-SHA256) wrapper:

- Every secret field (env values, license keys, admin passwords, app-user
  tokens, file attachments, device passwords, environment-credential passwords)
  is **encrypted on write** in the serializer's `create`/`update`.
- List endpoints return secrets **masked** (`••••••••`); plaintext is only
  returned by dedicated **`/reveal/`** endpoints (which are themselves logged).
- Decryption fails **gracefully** — if a value can't be decrypted, the original
  is returned instead of crashing.

### Authentication & JWT

- Login issues an **access + refresh** token pair with the user's role embedded
  as a custom claim.
- Refresh tokens **rotate** and old ones are **blacklisted** after rotation.
- Changing a password blacklists all of that user's outstanding tokens, forcing
  re-login everywhere.

### Account lockout (brute-force protection)

Implemented in
[apps/authentication/services.py](../backend/apps/authentication/services.py):

- After **3 failed attempts** an account is locked for **5 minutes**.
- Attempt counts and lockout state are tracked in **Redis** (fast path) and
  **mirrored to the database** (durable fallback).
- Failed attempts are recorded even for unknown emails to resist
  enumeration-by-timing.
- `LoginAttemptMiddleware` blocks locked accounts before the view runs.

### Role-Based Access Control

Two layers of authorization:

- **System role** on `User`: `ADMIN` (sees everything) vs `DEVELOPER`.
- **Project-level role** via `ProjectMember`, enforced by custom permissions in
  [apps/projects/permissions.py](../backend/apps/projects/permissions.py):
  - `IsProjectMember` — system admin, project creator, or any member.
  - `IsProjectAdmin` — system admin, creator, or member with `ADMIN` role.
  - `CanDeleteProjectRecord` — only admins may delete.

`ProjectService.get_projects_for_user` scopes querysets: admins see all
projects; developers see projects they created or are members of.

### Other hardening

- **CSRF middleware is intentionally omitted** — the API uses stateless JWT
  Bearer tokens, not session cookies.
- **CORS** is restricted to the configured frontend origins.
- **Throttling** (DRF): `anon` 20/min, `user` 100/min, `login` 5/min — backed
  by a dedicated in-process cache so throttle checks never depend on Redis.
- **Request logging** masks any field named like `password`, `token`, `secret`,
  `key`, etc.

---

## 8. Notifications

[apps/notifications/services.py](../backend/apps/notifications/services.py)
implements **upward-visibility** fan-out: when a `DEVELOPER` performs an action,
both developers and admins are notified; an `ADMIN` action notifies admins only.
The sender never notifies themselves. Notifications are created with
`bulk_create` for efficiency.

---

## 9. Reports

[apps/reports/](../backend/apps/reports/) provides:

- **Recent activity feed** — JSON list of latest activity, scoped to the user's
  visible projects.
- **PDF activity report** (`reportlab`) — an **admin-only**, branded PDF grouped
  by project with summary stats, date-range filtering (max 365 days), streamed
  as a file download.

---

## 10. API Reference

All routes are prefixed with **`/api/v1/`**. The full URL map is in
[config/urls.py](../backend/config/urls.py).

### Authentication — `/api/v1/auth/`
| Method | Path        | Description                          | Auth   |
| ------ | ----------- | ------------------------------------ | ------ |
| POST   | `login/`    | Authenticate, returns token pair     | Public |
| POST   | `refresh/`  | Rotate refresh / issue access token  | Public |
| POST   | `logout/`   | Blacklist refresh token              | Yes    |
| GET    | `me/`       | Current user profile                 | Yes    |

### Projects — `/api/v1/projects/`
| Method        | Path                                            | Description                       |
| ------------- | ----------------------------------------------- | --------------------------------- |
| GET / POST    | `/`                                             | List / create projects            |
| GET/PATCH/DEL | `{project_id}/`                                 | Retrieve / update / delete        |
| POST          | `{project_id}/reveal/`                          | Reveal project password           |
| GET / POST    | `{project_id}/members/` (alias `team/`)         | List / add members                |
| DELETE        | `{project_id}/members/{user_id}/`               | Remove member                     |
| —             | `{project_id}/env-variables/…`                  | CRUD + `/reveal/` for env vars     |
| —             | `{project_id}/license-keys/…`                   | CRUD + `/reveal/` for license keys |
| —             | `{project_id}/admin-credentials/…`              | CRUD + `/reveal/`                  |
| —             | `{project_id}/app-users/…`                      | CRUD + `/reveal/`                  |
| GET           | `{project_id}/activity-log/`                    | Per-project audit trail           |

### Teams - `/api/v1/teams/`
List/create teams, retrieve/update/delete a team, manage members, create a user
from a member, and reveal a member's stored password.

### Settings - `/api/v1/settings/`
`GET/PATCH profile/` and `POST change-password/`.

### Reports - `/api/v1/reports/`
`GET activity/` (PDF, admin only) and `GET recent-activity/`.

### Notifications - `/api/v1/notifications/`
List, `unread-count/`, `mark-all-read/`, and `{id}/read/`.

### Device Credentials — `/api/v1/devices/`

| Method     | Path                                               | Description                              | Auth         |
| ---------- | -------------------------------------------------- | ---------------------------------------- | ------------ |
| GET        | `/`                                                | List all devices                         | Any auth     |
| POST       | `/`                                                | Create device                            | Admin only   |
| PATCH      | `{pk}/`                                            | Update device                            | Admin only   |
| DELETE     | `{pk}/`                                            | Delete device                            | Admin only   |
| GET        | `{pk}/reveal/`                                     | Reveal decrypted passwords               | Any auth     |
| GET / POST | `projects/{project_id}/`                           | List / link device to a project          | Any / Admin  |
| DELETE     | `projects/{project_id}/{device_id}/`               | Unlink device from project               | Admin only   |

### Environment Credentials — `/api/v1/projects/{project_id}/environment-credentials/`

| Method | Path        | Description                                       |
| ------ | ----------- | ------------------------------------------------- |
| GET    | `/`         | List Dev + Deployment credential records          |
| PATCH  | `{pk}/`     | Update a credential record (partial update)       |
| GET    | `{pk}/reveal/` | Reveal decrypted passwords                     |

### Frontend catch-all
Any unmatched path is handed to
[utils/frontend.py](../backend/utils/frontend.py), which serves the Next.js
static export from `frontend/out/`, so a single Django process serves both the
API and the SPA.

---

## 11. Running Locally

```bash
cd backend
python -m venv venv && source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env                               # then edit values
# generate a Fernet key:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The default settings module is `config.settings.base` (see
[manage.py](../backend/manage.py)). Redis is optional for local development
because the lockout logic falls back to the database.

---

## 12. Testing

Tests use **pytest** with the dedicated
[config/settings/test.py](../backend/config/settings/test.py) module, which runs
against an **in-memory SQLite** database and a **LocMem cache** (no Redis
required) with a deterministic Fernet key.

```bash
cd backend
pytest
```

Covered areas include authentication endpoints, login flow, account lockout,
project logic, activity-log retention, settings serializers/views, and
notifications.

---

## 13. Recent Changes (2026-06-24)

### ENV Variable Key Validator — `.env` / `.env.local` Support

`EnvVariableWriteSerializer.validate_key()` was relaxed to accept **any non-empty string verbatim** (including dot-prefixed names such as `.env`, `.env.local`). A serializer-level uniqueness guard on `(project, key, environment)` returns a friendly 400 instead of letting the database constraint produce a 500.

**File:** `apps/env_variables/serializers.py`

### App User Email Made Optional

`AppUserWriteSerializer` now declares `email` with `required=False, allow_blank=True`, matching the model's `EmailField(blank=True)`. No migration required. The frontend form label was also updated to mark the field as optional.

**File:** `apps/app_users/serializers.py`

### New App — `device_credentials`

A new Django app manages **system-wide device credentials** (IP, RustDesk ID, and three encrypted password fields) independently of any specific project. Key design decisions:

- `DeviceCredential` stores all three passwords Fernet-encrypted.
- `ProjectDevice` is a lightweight join table linking a device to a project UUID — it does **not** FK to the `Project` model, keeping the device registry independent.
- `IsAdminRole` permission gates write operations; any authenticated user can list/reveal.
- All routes are under `/api/v1/devices/` and registered in `config/urls.py`.

**Files:** `apps/device_credentials/models.py`, `serializers.py`, `views.py`, `permissions.py`, `urls.py`

### New App — `environment_credentials`

A new Django app stores **per-project Development / Deployment system credentials** (system name, system IP, admin password, RustDesk IP, RustDesk password). Each project has at most one record per environment type (unique on `project + environment_type`). Routes are nested under the projects URL namespace: `/api/v1/projects/{project_id}/environment-credentials/`.

**Files:** `apps/environment_credentials/models.py`, `serializers.py`, `views.py`, `signals.py`, `urls.py`

---

## 14. Summary

The backend is a layered Django REST API that:

- Stores projects and their secrets with **per-field Fernet encryption** and
  masked-by-default reads.
- Authenticates with **rotating JWTs**, enforces **account lockout**, and
  applies **two-tier (system + project) RBAC**.
- Records a **durable audit trail**, sends **role-aware notifications**, and
  produces **branded PDF reports**.
- Keeps business logic in **services**, HTTP handling in **thin views**, and
  returns a **uniform JSON envelope** throughout.
- Can serve the compiled frontend itself, deploying as a single unit.
- Manages **system-wide device credentials** (Admin-only write, any-auth read/reveal)
  and **per-project environment credentials** via two new dedicated apps.