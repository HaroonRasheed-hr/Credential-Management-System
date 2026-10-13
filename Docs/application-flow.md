# Application Flow — Credential Management System

This document explains how the application works **end to end**, how a request
travels from the browser, through the Next.js frontend, into the Django backend,
down to the database, and back. It ties together the two halves documented in
[frontend-documentation.md](frontend-documentation.md) and
[backend-documentation.md](backend-documentation.md).

> **Note:** The portal now runs as a **full-stack app** (Next.js frontend +
> Django REST backend). The "client-side only / localStorage" framing in the
> older frontend doc is superseded — real data now persists **server-side via
> the API**. Browser storage is used only for JWT tokens, a cached session, and
> a few legacy admin helpers.

---

## 1. System Overview

The system has two cooperating parts that can be deployed as **one unit**:

| Part      | Technology                | Responsibility                                        |
| --------- | ------------------------- | ----------------------------------------------------- |
| Frontend  | Next.js 15 / React 19     | UI, routing, client state, calls the REST API         |
| Backend   | Django 4.2 + DRF          | Auth, business logic, encryption, persistence, audit  |
| Database  | SQLite (swappable)        | Stores users, projects, secrets, logs, notifications  |
| Cache     | Redis (optional)          | Login-attempt tracking and lockout                    |

```
┌──────────────┐   HTTPS / JSON    ┌─────────────────────────────┐   ORM   ┌──────────┐
│   Browser    │ ───────────────▶ │   Django REST API           │ ──────▶ │ Database │
│ Next.js SPA  │  Bearer <JWT>     │  middleware → view →        │         │ (SQLite) │
│ (React)      │ ◀─────────────── │  service → model            │ ◀────── │          │
└──────────────┘  {success,data}   └─────────────────────────────┘         └──────────┘
                                          │
                                          ▼  (login lockout)
                                     ┌─────────┐
                                     │  Redis  │
                                     └─────────┘
```

In production the compiled frontend is served by Django itself: any non-API URL
falls through to a catch-all that returns the Next.js static export (see
§9 Deployment Flow).

---

## 2. The Request Pipeline (Big Picture)

Every authenticated API call follows the same path:

```
React component
   │  calls a hook/context method
   ▼
axios client (lib/api.ts)
   │  request interceptor attaches  Authorization: Bearer <access>
   ▼
──────────────── network ────────────────
   ▼
Django middleware chain
   │  1. RequestLoggerMiddleware  → logs request (passwords masked)
   │  2. LoginAttemptMiddleware   → 423 fast-path if account locked (login only)
   │  3. JWTAuthMiddleware        → decodes claims, attaches request.user
   ▼
DRF view
   │  4. JWTAuthentication        → AUTHORITATIVE token check (sig/expiry/blacklist)
   │  5. Permission classes       → IsAuthenticated / IsProjectMember / IsProjectAdmin
   │  6. Serializer               → validates input, encrypts secrets
   │  7. Service                  → business logic, activity logging, notifications
   │  8. Model / ORM              → reads/writes the database
   ▼
Standard JSON envelope  { success, message, data }
   ▼
──────────────── network ────────────────
   ▼
axios response
   │  if 401 → response interceptor auto-refreshes the token and retries
   ▼
Context/hook updates React state → UI re-renders
```

---

## 3. Authentication Flow

### 3.1 Login

```
LoginForm → useAuth().login(email, password)
   │
   ▼
apiLogin()  POST /api/v1/auth/login/   { email, password }
   │
   ▼  (backend)
LoginAttemptMiddleware → locked?  ── yes ──▶ 423 { code: account_locked, retry_after }
   │ no
   ▼
AuthService.authenticate()
   │  • is account locked? (Redis → DB fallback)
   │  • user exists & active?
   │  • check_password()  ── fail ──▶ record attempt; lock after 3 → 401 / 423
   │  • success → clear attempts, stamp last_login, issue JWT pair
   ▼
200 { success, data: { access, refresh, user } }
   │
   ▼  (frontend)
saveTokens(access, refresh)   → localStorage
saveSession(user)             → sessionStorage
setUser(user)                 → React state
   │
   ▼
Redirect → /dashboard (Admin) or /dashboard/projects (Developer)
```

The JWT carries the user's `role`, `email`, and `username` as claims so the
backend can read them without an extra query.

### 3.2 Session Restore (on page load / refresh)

```
AuthProvider mounts
   │
   ├─ cached session + access token present?  ── yes ──▶ use cached user (no network)
   │
   └─ access token only? → apiMe()  GET /api/v1/auth/me/
                              │ valid   → rebuild session, cache it
                              └ invalid → clearTokens()
```

`AuthGuard` wraps every `/dashboard/*` route: it shows a loader while restoring,
redirects to `/login` if there is no user, and renders the page once a user is
confirmed.

### 3.3 Automatic Token Refresh

The axios response interceptor (`lib/api.ts`) transparently recovers from an
expired access token:

```
Any API call → 401 Unauthorized
   │
   ▼
Interceptor: have a refresh token?
   │ no  → clearTokens() → redirect /login
   │ yes
   ▼
POST /api/v1/auth/refresh/  { refresh }
   │  backend rotates refresh + blacklists the old one
   ▼
saveTokens(newAccess, newRefresh)
   │
   ▼
Replay the original request with the new token
   (concurrent 401s are queued and replayed once, not refreshed N times)
```

### 3.4 Logout

```
ProfileDropdown → useAuth().logout()
   │
   ▼
POST /api/v1/auth/logout/  { refresh }   → backend blacklists the refresh token
   │
   ▼
clearTokens() + setUser(null)  → AuthGuard redirects to /login
```

---

## 4. Authenticated Data Flow (CRUD)

Each domain (projects, env variables, license keys, admin credentials, app
users, teams) is driven by a dedicated React hook (`useApiProjects`,
`useEnvVariables`, `useLicenseKeys`, `useAdminCredentials`, `useAppUsers`,
`useTeamDetail`) or context that wraps the shared axios client.

### Example: Listing and creating projects

```
ProjectsProvider mounts (user present)
   │
   ▼
GET /api/v1/projects/
   │  backend: ProjectService.get_projects_for_user(user)
   │    • ADMIN     → all projects
   │    • DEVELOPER → projects they created or are a member of
   ▼
{ data: { results: [...] } }  → mapped to UI shape → rendered as cards


"Add Project" (Admin) → createProject(payload)
   │
   ▼
POST /api/v1/projects/   { name, description, password, ... }
   │  backend: serializer encrypts the project password,
   │           stamps created_by, logs the activity, fans out notifications
   ▼
201 { data: project }  → prepended to local state → UI updates
```

Update and delete follow the same shape (`PATCH` / `DELETE
/api/v1/projects/{id}/`) with **optimistic UI updates** — the frontend updates
state immediately and reconciles with the server response.

Because the backend already scopes the project list to the user, the frontend's
`canViewProject()` simply returns `true` for any project it received — the
**authoritative visibility decision lives on the server**.

---

## 5. Reveal-Secret Flow (Encryption Boundary)

Secrets are **encrypted at rest** (Fernet) and **masked by default**. Plaintext
is only produced by an explicit, audited reveal call.

```
Credentials tab shows values masked:  ••••••••
   │
   │ user clicks the 👁 (eye) icon on a row
   ▼
GET /api/v1/projects/{pid}/env-variables/{id}/reveal/
   │  backend:
   │    • permission check (project member/admin)
   │    • EncryptionService.decrypt(value)
   │    • ProjectService.log_activity(action=REVEALED)   ← reveals are audited
   ▼
{ data: { value: "<plaintext>" } }  → shown inline until toggled off
```

The same `…/reveal/` pattern exists for license keys, admin credentials, app
users, and team-member passwords. List endpoints **never** return plaintext.

---

## 6. Authorization & Visibility Flow (RBAC)

Authorization is enforced on **two levels**, always server-side:

```
                       ┌─────────────────────────────┐
Request with JWT ─────▶│ System role on the User      │
                       │   ADMIN    → sees everything  │
                       │   DEVELOPER→ scoped access     │
                       └──────────────┬───────────────┘
                                      ▼
                       ┌─────────────────────────────┐
                       │ Project role (ProjectMember) │
                       │   IsProjectMember  → read     │
                       │   IsProjectAdmin   → manage   │
                       │   CanDelete…       → delete    │
                       └─────────────────────────────┘
```

- A **system ADMIN** bypasses project checks.
- A **project creator** is treated as a project admin.
- Otherwise the user's `ProjectMember.role` decides read vs. manage vs. delete.

The frontend mirrors these rules for UX (hiding buttons a user can't use), but
the backend permission classes are the real gate — a forged request is rejected
regardless of what the UI shows.

---

## 7. Activity Logging & Notification Flow

Logging and notifications now happen **server-side**, as a side effect of write
and reveal operations.

```
User performs an action (create / update / delete / reveal)
   │
   ▼ (backend, inside the view/service)
ActivityLog.objects.create(project, user, action, module, description)
   │   • stores a denormalized project_name so the log survives project deletion
   │
   ▼
NotificationService.send(sender, action, module, title, message)
   │   upward-visibility fan-out:
   │     DEVELOPER action → notify DEVELOPER + ADMIN
   │     ADMIN     action → notify ADMIN only
   │   (sender never notifies themselves; bulk_create for efficiency)
   ▼
Recipients' notifications persist in the DB
```

On the frontend:

```
Bell icon polls/reads  GET /api/v1/notifications/unread-count/  → badge
NotificationPanel      GET /api/v1/notifications/               → recent list
                       PATCH /api/v1/notifications/{id}/read/   → mark one read
                       POST  /api/v1/notifications/mark-all-read/
Project "Activity Log" GET /api/v1/projects/{id}/activity-log/  → per-project trail
```

---

## 8. Reports Flow

```
Admin → Reports → pick date range
   │
   ▼
GET /api/v1/reports/activity/?from_date=…&to_date=…
   │  backend (admin-only):
   │    • validates range (≤ 365 days)
   │    • gathers ActivityLogs grouped by project
   │    • reportlab builds a branded PDF
   ▼
application/pdf  (Content-Disposition: attachment)  → browser downloads the file

Dashboard "recent activity" widget →
GET /api/v1/reports/recent-activity/?limit=20   → JSON feed scoped to the user
```

---

## 9. Deployment Flow (Single Unit)

```
npm run build (frontend)  → static export in  frontend/out/
   │
   ▼
Django runs with config/urls.py:
   /admin/         → Django admin
   /api/v1/...     → REST API (auth, projects, teams, settings, reports, notifications)
   /<anything>     → utils/frontend.serve_frontend()  → serves frontend/out/
```

`serve_frontend` resolves each request in order: exact asset → directory
`index.html` → dynamic-route shell → parent index → root `index.html` fallback
(so the client-side router can take over). The result: **one Django process
serves both the API and the SPA** from the same origin, which also makes CORS a
non-issue in production.

---

## 10. Error & Edge-Case Flows

| Situation                        | What happens                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Wrong password                   | 401 `invalid_credentials`; attempts counted; UI shows remaining attempts     |
| 3 failed logins                  | Account locked 5 min; middleware returns 423 `account_locked` + `retry_after`|
| Expired access token             | axios interceptor refreshes once and replays the request transparently       |
| Refresh token invalid/expired    | Tokens cleared; user redirected to `/login`                                  |
| Redis unavailable                | Lockout falls back to the database; requests are not blocked                  |
| Backend unreachable              | `login()` returns `network_error`; UI shows "Is the backend running?"        |
| Non-admin hits an admin endpoint | 403 from the permission layer; UI also hides the entry point                 |
| Decryption fails for a secret    | Original stored value returned instead of crashing (graceful degradation)    |

---

## 11. End-to-End Example (Putting It Together)

A developer adds an environment variable to a project:

```
1. UI    → AddEnvVariableForm submit → useEnvVariables().create(payload)
2. axios → POST /api/v1/projects/{pid}/env-variables/  (+ Bearer token)
3. Django→ middleware logs request (value masked) → JWTAuthentication verifies token
4. View  → IsProjectMember permission passes (developer is a member)
5. Serial→ EncryptionService.encrypt(value); updated_by = current user
6. Model → row written to env_variables table (value stored as ciphertext)
7. Service→ ActivityLog (action=CREATED) + NotificationService.send()
          → admins of the org receive a notification (upward visibility)
8. Resp  → 201 { success, data } → hook prepends it to state → list re-renders
9. Later → another user clicks 👁 → /reveal/ decrypts → action logged as REVEALED
```

This single action exercises authentication, authorization, validation,
encryption, persistence, auditing, and notifications — the full stack working
together.

---

*Application flow documentation for the Credential Management System.*
