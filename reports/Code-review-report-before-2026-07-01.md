# Code Health Review - Memory & Performance Checklist

**Date:** 2026-07-01
**Reviewer:** Automated read-only audit (Claude Code)
**Scope:** `backend/` (Django REST API) and `frontend/` (Next.js / React)
**Checklist:** xis.ai - Requirements for Code Submissions, §6.2.1 (Django/Python) and §6.2.2 (React)

> This is a **status report only**. No code was changed, added, or removed. Every
> item below records the *current* condition of the code with file references so
> the team can decide what (if anything) to act on. Recommendations are written
> as notes, not applied changes.

---

## Summary

| # | Checklist item | Area | Status |
|---|----------------|------|--------|
| 1 | `DEBUG=False` in production | Django | Pass |
| 2 | Worker memory / RSS, recycle with `--max-requests` | Django | Gap |
| 3 | N+1 queries (`select_related` / `prefetch_related`) | Django | Partial |
| 4 | DB connections, no pool exhaustion | Django | Pass (with caveat) |
| 5 | Heavy work off the request (Celery) | Django | Partial |
| 6 | Temp-file cleanup | Django | Pass |
| 7 | Load test (Locust/k6, p50/p95/p99) | Django | Gap (no tooling) |
| 8 | `useEffect` cleanup (listeners/intervals/subscriptions) | React | Mostly pass |
| 9 | Heap snapshots | React | Process item, not verifiable from code |
| 10 | Image/frame cleanup, revoke object URLs | React | Pass |
| 11 | Request cancellation, `AbortController` on unmount | React | Gap |
| 12 | Sustained-use test (JS heap / DOM node count) | React | Process item not verifiable from code |

Legend: Pass · Partial · Gap · Not verifiable from source

**Most important findings (ranked):**
1. **Production runs the Django dev server, not Gunicorn** no worker model, no `--max-requests` recycling (items 2 & 7). See [Dockerfile](../Dockerfile).
2. **N+1 in the projects list** 5 `COUNT` queries per project per page (item 3). See [serializers.py:46-59](../backend/apps/projects/serializers.py#L46-L59).
3. **No `AbortController` anywhere** in-flight fetches are never cancelled on unmount, including a 15s live-poll feed (item 11).

---

## §6.2.1 Django / Python

### 1. `DEBUG=False` in production - Pass

- Default is safe: `DEBUG = config('DEBUG', default=False, cast=bool)` - [base.py:9](../backend/config/settings/base.py#L9).
- Production compose makes `DEBUG` a required env var (fails fast if unset): `DEBUG=${DEBUG:?Error: DEBUG not set}` in [docker-compose.prod.yml](../docker-compose.prod.yml).
- No hardcoded `DEBUG=True` found in settings.

**Note:** `ALLOWED_HOSTS` defaults to `'*'` ([base.py:10](../backend/config/settings/base.py#L10)); prod compose overrides it, but the permissive default is worth being aware of.

### 2. Worker memory over time / recycle with `--max-requests` - Gap

- The runtime image starts the app with the **Django development server**:
  `CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]` - [Dockerfile](../Dockerfile) (Stage 3).
- **No Gunicorn / uWSGI / uvicorn** is installed - [requirements.txt](../backend/requirements.txt) has no WSGI/ASGI server.
- Consequence relative to the checklist:
  - There is no worker model, so there is **no per-worker RSS to recycle** and **no `--max-requests`** to bound memory growth.
  - `runserver` is single-process/threaded and explicitly not for production; any per-request memory growth is never reclaimed by a worker recycle.
- [Docs/PRODUCTION_DEPLOYMENT.md](../Docs/PRODUCTION_DEPLOYMENT.md) does not mention a production server either.

**Recommendation (not applied):** run under Gunicorn (or uvicorn workers) with `--max-requests` / `--max-requests-jitter` for the production deployment.

### 3. N+1 queries - Partial

**Good:** most list endpoints already use `select_related` / `prefetch_related` - e.g. [teams/views.py:75](../backend/apps/teams/views.py#L75) (`prefetch_related('members__user', 'members__added_by')`), [reports/views.py:35](../backend/apps/reports/views.py#L35), [activity_log/views.py:33](../backend/apps/activity_log/views.py#L33), and others.

**N+1 present - projects list:** `ProjectListSerializer` computes five counts as `SerializerMethodField`s, each doing its own `.count()`:

```
get_member_count → obj.members.count()
get_env_count → obj.env_variables.count()
get_license_count → obj.license_keys.count()
get_admin_cred_count → obj.admin_credentials.count()
get_app_user_count → obj.app_users.count()
```

[serializers.py:46-59](../backend/apps/projects/serializers.py#L46-L59). The list queryset only does `select_related('created_by')` with no count annotations - [views.py:36-48](../backend/apps/projects/views.py#L36-L48). With `PAGE_SIZE = 10` ([base.py:180](../backend/config/settings/base.py#L180)) that is **~51 queries per list page** (1 list + 5×10 counts). The same pattern exists in `ProjectDetailSerializer` ([serializers.py:85-98](../backend/apps/projects/serializers.py#L85-L98)) but only affects a single object per request there.

**Detection tooling:** neither `django-silk` nor `django-debug-toolbar` is installed ([requirements.txt](../backend/requirements.txt)), so N+1s are not surfaced automatically in development.

**Recommendation (not applied):** replace the per-count methods on the *list* serializer with `.annotate(Count(...))` on the queryset (single query), and consider adding `django-debug-toolbar` in the dev settings for detection.

### 4. DB connections - no pool exhaustion - Pass (with caveat)

- Persistent connections are configured for PostgreSQL: `CONN_MAX_AGE: 600` and `CONN_HEALTH_CHECKS: True` - [base.py:96-97](../backend/config/settings/base.py#L96-L97).
- **Caveat:** `CONN_MAX_AGE > 0` means each process holds a connection open for 10 minutes. This is correct once a multi-worker server is used, but it interacts with item 2, connection count scales with worker count, so pick `max_connections` / a pooler (e.g. PgBouncer) to match the eventual worker count. Not an issue under the current single-process `runserver`.

### 5. Heavy work off the request (Celery) - Partial / mostly N/A

- This is a credentials-vault app; there is **no CV / video / image processing** in the codebase.
- No Celery or task queue is present ([requirements.txt](../backend/requirements.txt), no `celery`/broker).
- The one genuinely heavy synchronous task is **PDF report generation** with reportlab, run inline in the request thread, [reports/views.py:138-155](../backend/apps/reports/views.py#L138-L155), building the document at [reports/services.py:235](../backend/apps/reports/services.py#L235). It is admin-only and bounded to a 365-day range ([reports/views.py:107-108](../backend/apps/reports/views.py#L107-L108)), but under the current single-process server a large report blocks all other requests for its duration.

**Recommendation (not applied):** if report sizes grow, move PDF generation to a background worker (or at least ensure it runs under a multi-worker server so one report does not block the whole process).

### 6. Temp-file cleanup - Pass

- The PDF is built entirely **in memory** via `io.BytesIO()` ([reports/services.py:235](../backend/apps/reports/services.py#L235)) and returned as `HttpResponse(pdf_bytes, ...)` ([reports/views.py:152](../backend/apps/reports/views.py#L152)), no temp file is written to disk, so there is nothing to leak or clean up. The buffer is released by GC after the response.
- No `tempfile` / `NamedTemporaryFile` / disk-write patterns found in the app code.

**Adjacent note (not a temp file):** application logs use a plain `FileHandler` in append mode with **no rotation** [base.py:245-251](../backend/config/settings/base.py#L245-L251) (`logs/django.txt`). Every request is logged ([request_logger.py](../backend/middleware/request_logger.py)), so this file grows unbounded over time. Consider `RotatingFileHandler` / `TimedRotatingFileHandler`.

### 7. Load test (Locust / k6, p50/p95/p99) - Gap

- No load-testing tooling or scripts present (no `locust`, no `k6`, no results committed). This is a process/verification item; nothing in the repo indicates a load test with recorded p50/p95/p99 or memory-under-load has been run.

---

## §6.2.2 React

### 8. `useEffect` cleanup - Mostly pass

**Correctly cleaned up:**
- Every `addEventListener` has a matching `removeEventListener` in the effect's cleanup - e.g. click/keydown handlers in [DashboardHeader.tsx:133-144](../frontend/src/components/common/DashboardHeader.tsx#L133-L144), [NotificationPanel.tsx:25-36](../frontend/src/components/common/NotificationPanel.tsx#L25-L36), [ProfileDropdown.tsx:46-57](../frontend/src/components/common/ProfileDropdown.tsx#L46-L57); `storage`/`popstate` in [AuthContext.tsx:113-114](../frontend/src/context/AuthContext.tsx#L113-L114), [ProjectsContext.tsx:154-155](../frontend/src/context/ProjectsContext.tsx#L154-L155); `resize`/`wheel`/`touch` in [LoginScaleWrapper.tsx:57-60](../frontend/src/components/login/LoginScaleWrapper.tsx#L57-L60).
- The one polling interval clears itself and its focus listener on unmount: [AllNotificationsPage.tsx:24-32](../frontend/src/components/common/AllNotificationsPage.tsx#L24-L32). Its `refetch` is memoized (`useCallback([limit])` in [useRecentActivities.ts:42-84](../frontend/src/hooks/useRecentActivities.ts#L42-L84)) so the effect does not churn.
- No `WebSocket` / `EventSource` in the codebase.

**Minor (low severity):** several fire-and-forget `setTimeout` calls for transient UI state (copy-to-clipboard "copied" flags, toast auto-dismiss) are **not** cleared on unmount - e.g. [AdminCredentialsPage.tsx:164](../frontend/src/components/projects/AdminCredentialsPage.tsx#L164), [CredentialsOverviewTab.tsx:827](../frontend/src/components/projects/CredentialsOverviewTab.tsx#L827), [SettingsPage.tsx:237](../frontend/src/components/settings/SettingsPage.tsx#L237), [MembersTable.tsx:473](../frontend/src/components/teams/MembersTable.tsx#L473). They use functional state updaters and are short-lived (1.5–3s); on React 18 the post-unmount `setState` is a harmless no-op, so this is a tidiness note rather than a leak. (Toaster and the debounce/toast timers in the teams pages *are* cleaned up correctly.)

### 9. Heap snapshots - Not verifiable from source

Chrome DevTools heap-snapshot analysis (detached DOM nodes, growing retained size) is a manual verification step; nothing in the repo confirms it was performed.

### 10. Image / frame cleanup - revoke object URLs - Pass

- The only `URL.createObjectURL` usage (PDF download) revokes the URL and removes the temporary anchor after clicking: [useExportReport.ts:57-64](../frontend/src/hooks/useExportReport.ts#L57-L64).
- No frames/images are held in component state (no video/CV workflow in this app).

### 11. Request cancellation - `AbortController` on unmount - Gap

- **No `AbortController` / cancel token anywhere** in `frontend/src`.
- Data hooks fetch inside `useEffect` with **no cleanup and no abort** - e.g. [useProjects.ts:56-58](../frontend/src/hooks/useProjects.ts#L56-L58) and [useRecentActivities.ts:80-82](../frontend/src/hooks/useRecentActivities.ts#L80-L82). If the component unmounts (or a dependency changes) mid-request, the request keeps running and the resolver still calls `setState`.
- Most impactful case: [AllNotificationsPage.tsx](../frontend/src/components/common/AllNotificationsPage.tsx) polls every 15s and on window focus; those requests are never cancelled on navigation away.
- The shared axios instance sets a 15s `timeout` ([api.ts:13](../frontend/src/lib/api.ts#L13)) but never receives a `signal` from callers, so requests are not aborted on unmount.

**Recommendation (not applied):** thread an `AbortController` (or axios `signal`) through the data hooks and abort it in the `useEffect` cleanup; guard `setState` against a `cancelled` flag.

### 12. Sustained-use test (JS heap / DOM node count) - Not verifiable from source

Repeating a real workflow while watching the JS heap and DOM node count is a manual step; nothing in the repo confirms it was run.

---

## Items outside the checklist noticed during review (informational only)

- **Log growth:** unbounded append-mode log file, no rotation - [base.py:245-251](../backend/config/settings/base.py#L245-L251).
- **Request body logging:** the request logger reads and serializes `request.body` for every JSON request - [request_logger.py:66-79](../backend/middleware/request_logger.py#L66-L79). Fine for the small JSON payloads here; would matter if large uploads are ever added.
- **Token-refresh queue:** on refresh failure the module-level `refreshQueue` callbacks are not invoked ([api.ts:62-68](../frontend/src/lib/api.ts#L62-L68)); in practice the page navigates to `/login` so queued promises are discarded on unload. Not a sustained leak, but worth noting.

---

## Suggested priority order (if the team chooses to act)

1. Serve production under Gunicorn/uvicorn with `--max-requests` (items 2, 7).
2. Fix the projects-list N+1 with `annotate(Count(...))` (item 3).
3. Add `AbortController` to the data hooks, starting with the live-polling feed (item 11).
4. Add log rotation (informational).
5. Add `django-debug-toolbar` (dev) + a Locust/k6 smoke test to make items 3 and 7 measurable going forward.

*No source files were modified in producing this report.*
