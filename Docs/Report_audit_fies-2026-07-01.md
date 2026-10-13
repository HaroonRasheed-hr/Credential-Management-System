# Memory & Performance Audit - Fixes (2026-07-01)

This document describes the changes made to address the memory & performance
findings from the **Code Health Review (§6.2.1 and §6.2.2)**. It is a
change-log / hand-off document: for each item it lists **which files changed**,
**what changed**, **why**, and **how it was verified**.

> Scope note: only the files listed below were modified. No git push/pull or
> remote operations were performed. All changes are behaviour-preserving except
> where explicitly called out (see "Behaviour notes").

---

## Summary table

| # | Area | Files changed | Risk |
| - | ---- | ------------- | ---- |
| 1 | Production app server (Gunicorn) | `Dockerfile`, `backend/requirements.txt`, `Docs/PRODUCTION_DEPLOYMENT.md` | Low |
| 2 | N+1 queries on projects list | `backend/apps/projects/views.py`, `backend/apps/projects/serializers.py`, `backend/requirements.txt`, `backend/config/settings/base.py` | Low |
| 3 | React request cancellation | `frontend/src/lib/api.ts`, `frontend/src/hooks/useRecentActivities.ts`, `frontend/src/hooks/useProjects.ts`, `frontend/src/components/common/AllNotificationsPage.tsx` | Low |
| 4 | Log rotation | `backend/config/settings/base.py` | Low |
| 5 | `setTimeout` cleanup on unmount (optional) | `frontend/src/components/projects/AdminCredentialsPage.tsx`, `frontend/src/components/teams/MembersTable.tsx`, `frontend/src/components/settings/SettingsPage.tsx`, `frontend/src/components/projects/CredentialsOverviewTab.tsx` | Low |

**Full list of modified files (14):**

```
Dockerfile
backend/requirements.txt
backend/apps/projects/views.py
backend/apps/projects/serializers.py
backend/config/settings/base.py
Docs/PRODUCTION_DEPLOYMENT.md
frontend/src/lib/api.ts
frontend/src/hooks/useRecentActivities.ts
frontend/src/hooks/useProjects.ts
frontend/src/components/common/AllNotificationsPage.tsx
frontend/src/components/projects/CredentialsOverviewTab.tsx
frontend/src/components/projects/AdminCredentialsPage.tsx
frontend/src/components/teams/MembersTable.tsx
frontend/src/components/settings/SettingsPage.tsx
```

---

## Item 1 - Production was running the Django dev server

**Problem:** the container served traffic with `python manage.py runserver`, which
is single-threaded and explicitly not meant for production.

### `Dockerfile` (Stage 3 - runtime)

- Replaced the `runserver` `CMD` with a **Gunicorn** command that still runs
  migrations first.
- Added `ENV` defaults for the tuning knobs.

**Before**
```dockerfile
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
```

**After**
```dockerfile
ENV GUNICORN_MAX_REQUESTS=1000 \
    GUNICORN_MAX_REQUESTS_JITTER=100 \
    GUNICORN_TIMEOUT=60

EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-$((2 * $(nproc) + 1))} --max-requests ${GUNICORN_MAX_REQUESTS} --max-requests-jitter ${GUNICORN_MAX_REQUESTS_JITTER} --timeout ${GUNICORN_TIMEOUT} --access-logfile - --error-logfile -"]
```

**What each setting does**
- `--workers ${GUNICORN_WORKERS:-$((2 * $(nproc) + 1))}` - worker count defaults to
  `(2 × CPU cores) + 1`, computed at container start from `nproc`. Overridable via
  the `GUNICORN_WORKERS` env var.
- `--max-requests 1000` / `--max-requests-jitter 100` - recycle each worker after
  ~1000 (±100) requests to bound memory growth from slow leaks; jitter staggers the
  restarts so workers don't all recycle at once.
- `--timeout 60` - kill/replace a worker whose request runs longer than 60s.
- `--access-logfile - --error-logfile -` - send logs to stdout/stderr for the Docker
  log driver.

> **IDE note:** an editor lint may warn "There can only be one CMD instruction."
> This is a false positive - there is exactly one `CMD`; the linter miscounts across
> the multi-stage build (stages 1 and 2 have no `CMD`).

### `backend/requirements.txt`

Added Gunicorn to the production section:
```
gunicorn>=22.0,<24.0
```
Gunicorn's console script is installed in the `backend-builder` stage and copied
into the runtime image via the existing `COPY --from=backend-builder /usr/local/bin`.

### `Docs/PRODUCTION_DEPLOYMENT.md`

- New **"Application Server (Gunicorn)"** section: the full startup command, an
  explanation of every flag, an override table for the four env vars, and the
  **database-connections vs `max_connections`** math (see human decisions below).
- Added the four `GUNICORN_*` variables to the **Optional** env var reference.

---

## Item 2 - N+1 queries on the projects list

**Problem:** `ProjectListSerializer` computed five counts as
`SerializerMethodField`s, each issuing its own `.count()` query. For a list of N
projects this produced ~5×N extra queries.

### `backend/apps/projects/views.py`

`ProjectListCreateView.get_queryset` now annotates the counts in a single query.

**Before**
```python
def get_queryset(self):
    return ProjectService.get_projects_for_user(self.request.user).select_related(
        'created_by'
    )
```

**After**
```python
from django.db.models import Count
...
def get_queryset(self):
    return (
        ProjectService.get_projects_for_user(self.request.user)
        .select_related('created_by')
        .annotate(
            member_count=Count('members', distinct=True),
            env_count=Count('env_variables', distinct=True),
            license_count=Count('license_keys', distinct=True),
            admin_cred_count=Count('admin_credentials', distinct=True),
            app_user_count=Count('app_users', distinct=True),
        )
        .order_by('-created_at')
    )
```

Notes:
- `distinct=True` is required, annotating multiple reverse-FK joins in one query
  would otherwise multiply/inflate the counts.
- `.order_by('-created_at')` is re-asserted because `annotate()` introduces a
  `GROUP BY` that **drops the model's `Meta.ordering`**. Without it the list would
  return rows in undefined order and Django would emit
  `UnorderedObjectListWarning` during pagination. This restores the original
  newest-first ordering.

### `backend/apps/projects/serializers.py`

`ProjectListSerializer` now reads the annotations directly instead of calling
`.count()`. The five `get_*_count` methods were removed.

**Before**
```python
member_count = serializers.SerializerMethodField()
...
def get_member_count(self, obj) -> int:
    return obj.members.count()
# (+ env_count, license_count, admin_cred_count, app_user_count)
```

**After**
```python
member_count = serializers.IntegerField(read_only=True)
env_count = serializers.IntegerField(read_only=True)
license_count = serializers.IntegerField(read_only=True)
admin_cred_count = serializers.IntegerField(read_only=True)
app_user_count = serializers.IntegerField(read_only=True)
```

`ProjectDetailSerializer` was **left unchanged** (single-object cost is acceptable,
per the audit note). The API response shape is identical - same field names, same
integer values - so no frontend change was required.

> Safety check: `ProjectListSerializer` is only used inside `ProjectListCreateView.list`,
> always on the annotated queryset, so the annotated attributes are always present.

### `backend/requirements.txt` + `backend/config/settings/base.py` (django-debug-toolbar)

Added `django-debug-toolbar` as a **dev-only** dependency so future N+1s are visible
locally, wired up in a guarded block that is a **no-op in production**.

`requirements.txt` (Development & Testing section):
```
django-debug-toolbar>=4.3,<6.0
```

`base.py` (after the `MIDDLEWARE` list):
```python
if DEBUG:
    try:
        import debug_toolbar  # noqa: F401
    except ImportError:
        pass
    else:
        INSTALLED_APPS += ['debug_toolbar']
        MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')
        INTERNAL_IPS = ['127.0.0.1', 'localhost']
```

The block only activates when `DEBUG=True` **and** the package is importable. In the
production image the package is not installed, so the `ImportError` branch makes it a
clean no-op. (To render the toolbar's full UI you must also add `debug_toolbar.urls`
to `config/urls.py` - intentionally left out of scope; noted inline in `base.py`.)

---

## Item 3 - No request cancellation in React

**Problem:** data-fetching hooks/components had no `AbortController`, so requests
could resolve into unmounted components (and the notifications page fired the most
often - a 15s poll plus a focus refetch).

### `frontend/src/lib/api.ts`

The shared axios instance already forwards a per-request `signal` alongside its 15s
`timeout`, so no functional change was needed there. Added a small re-export so hooks
can detect cancellations without importing raw axios:
```ts
export const isCancel = axios.isCancel;
```

### Pattern applied to each hook/component

- create an `AbortController` inside the `useEffect`,
- pass `controller.signal` to the axios call,
- `controller.abort()` in the effect cleanup,
- in the catch, `if (isCancel(e)) return;` (ignore cancellations),
- guard the `finally` state update with `if (!signal?.aborted) …`.

### `frontend/src/components/common/AllNotificationsPage.tsx` (done first most frequent)

The poll + focus effect now scopes an `AbortController` and passes its signal to each
`refetch`, aborting on unmount.

**Before**
```ts
useEffect(() => {
  const id = window.setInterval(refetch, REFRESH_MS);
  const onFocus = () => refetch();
  window.addEventListener("focus", onFocus);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("focus", onFocus);
  };
}, [refetch]);
```

**After**
```ts
useEffect(() => {
  const controller = new AbortController();
  const id = window.setInterval(() => refetch(controller.signal), REFRESH_MS);
  const onFocus = () => refetch(controller.signal);
  window.addEventListener("focus", onFocus);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("focus", onFocus);
    controller.abort();
  };
}, [refetch]);
```

### `frontend/src/hooks/useRecentActivities.ts` and `frontend/src/hooks/useProjects.ts`

- `refetch` return type widened from `() => void` to `(signal?: AbortSignal) => void`
  (backward-compatible; existing `refetch()` calls still work).
- the fetch callback accepts an optional `signal`, passes it to `api.get(url, { signal })`,
  ignores `isCancel` errors, and guards `setLoading(false)` on `signal?.aborted`.
- the mount `useEffect` creates a controller, passes its signal, and aborts on cleanup.

> Consumer safety: `useRecentActivities` is used by `AllNotificationsPage` (refetch
> updated) and `AdminDashboard` (does not use refetch). `useApiProjects` (in
> `useProjects.ts`) has no external `refetch` callers. So widening the signature
> breaks nothing.

---

## Item 4 - Log rotation

**Problem:** `logs/django.txt` used a plain `FileHandler` and could grow unbounded.

### `backend/config/settings/base.py` (LOGGING → handlers → file)

**Before**
```python
'file': {
    'class': 'logging.FileHandler',
    'filename': os.path.join(BASE_DIR, 'logs', 'django.txt'),
    'mode': 'a',
    'delay': False,
    'formatter': 'detailed',
},
```

**After**
```python
'file': {
    'class': 'logging.handlers.TimedRotatingFileHandler',
    'filename': os.path.join(BASE_DIR, 'logs', 'django.txt'),
    'when': 'midnight',
    'backupCount': 14,
    'encoding': 'utf-8',
    'delay': False,
    'formatter': 'detailed',
},
```

Rotates at midnight and keeps 14 days of history (files suffixed
`django.txt.YYYY-MM-DD`). A commented alternative for **size-based** rotation
(`RotatingFileHandler`, 50 MB × 5) is included inline for ops to choose (see human
decisions). `encoding='utf-8'` was added because log messages can contain non-ASCII
characters.

---

## Item 5 - Fire-and-forget `setTimeout` cleanup (optional / tidiness)

**Problem:** several components set a `setTimeout` inside an event handler with no
cleanup, so the timer could fire after unmount (a no-op leak on React 18/19).

All four were converted so the timer is created in a `useEffect` and cleared in the
effect's cleanup. The observable behaviour (how long the indicator/toast shows) is
unchanged.

### `frontend/src/components/projects/AdminCredentialsPage.tsx`
- Added `useEffect` to the React import.
- Added an effect that resets the "copied" indicator 1.5s after `copiedId` is set,
  clearing the timer on unmount / re-copy.
- The copy handler now just calls `setCopiedId(apiId)` (the inline `setTimeout` was
  removed).

### `frontend/src/components/teams/MembersTable.tsx`
- Same pattern as above for its `copiedId` indicator (1.5s).

### `frontend/src/components/settings/SettingsPage.tsx`
- Added an effect that clears the "profile saved" confirmation 3s after
  `profileSaved` becomes true, with cleanup.
- The save handler now just calls `setProfileSaved(true)`.
- **Left untouched:** the `setTimeout(() => router.push("/login"), 2000)` at
  ~line 275, it was not in scope, and it's a navigation redirect (clearing it on
  unmount could suppress the redirect).

### `frontend/src/components/projects/CredentialsOverviewTab.tsx`
This component had **several** entangled timers on the `toast` and `copiedField`
state. Because every `setToast(<string>)` was already paired with a 2s dismiss (and
every `setToast(null)` lived only in those timers), the timers were consolidated into
two state-driven effects and the inline `setTimeout`s were removed:
```ts
useEffect(() => {
  if (toast === null) return;
  const t = setTimeout(() => setToast(null), 2000);
  return () => clearTimeout(t);
}, [toast]);

useEffect(() => {
  if (copiedField === null) return;
  const t = setTimeout(() => setCopiedField(null), 1500);
  return () => clearTimeout(t);
}, [copiedField]);
```

**Behaviour note (minor, intentional improvement):** the effect resets the dismiss
timer whenever the toast/indicator changes, which fixes a latent edge case where a
rapid second toast could be dismissed early by the first toast's timer. The visible
behaviour for normal single-toast/single-copy usage is identical.

---

## Verification performed

| Check | Result |
| ----- | ------ |
| `python -m pytest apps/projects/tests/test_projects.py` | **25 passed**, no pagination warning |
| `python manage.py check` (DEBUG default/False) | No issues |
| `DEBUG=True python manage.py check` (exercises debug-toolbar guard) | No issues |
| Logging smoke test | `TimedRotatingFileHandler` active, `backupCount=14`, `when=MIDNIGHT` |
| `npx tsc --noEmit` (frontend) | Clean (exit 0) |
| `next lint` on all changed frontend files | No ESLint warnings or errors |

The projects tests directly exercise the list endpoint
(`test_system_admin_sees_all_projects`, `test_developer_sees_only_own_projects`,
`test_developer_sees_member_project`), which cover the annotate/serializer change.

---

## Items needing a human decision

1. **Gunicorn worker count** `(2 × cores) + 1` is a starting point; tune against
   real traffic via `GUNICORN_WORKERS`.
2. **Postgres `max_connections`** with `CONN_MAX_AGE=600`, peak connections ≈
   `workers × replicas` (+ overhead). Confirm the target Postgres/RDS instance's
   `max_connections` covers this with headroom. Small RDS classes allow only
   ~80–110 connections; if `workers × replicas` approaches that, add **PgBouncer**
   (transaction pooling) and set `CONN_MAX_AGE=0`. Documented in
   `Docs/PRODUCTION_DEPLOYMENT.md`.
3. **Log retention policy** chosen default is time-based (daily, 14 days). If ops
   manages retention by disk size, switch to the `RotatingFileHandler` variant
   (commented inline in `base.py`). File logs are secondary since console logs
   already go to stdout.
4. **debug-toolbar URLs** to render its full UI, add `debug_toolbar.urls` to
   `config/urls.py` (left out of scope). On this JSON API its value is mostly the
   SQL panel.

## Behaviour note to be aware of

The `Dockerfile` is shared by both `docker-compose.yml` (local) and
`docker-compose.prod.yml`, and **neither overrides `CMD`**. As a result, **local
docker now also runs Gunicorn** (no `runserver` auto-reload inside the container).
This matches the audit's intent; flagged in case a local workflow relied on
in-container hot reload (host-based `npm`/`manage.py runserver` workflows are
unaffected).
