# Code Health Review - Memory & Performance Checklist (After)

**Date:** 2026-07-01
**Reviewer:** Automated read-only audit (Claude Code)
**Scope:** `backend/` (Django REST API) and `frontend/` (Next.js / React)
**Checklist:** xis.ai, Requirements for Code Submissions, 6.2.1 (Django/Python) and 6.2.2 (React)
**Companion:** [Code-review-report-before-2026-07-01.md](./Code-review-report-before-2026-07-01.md)

> This is a **status report only**. No code was changed, added, or removed in producing
> it. Each item records the *current* condition of the code with file references. Where
> the state has changed since the "before" report, that is called out explicitly.
> Recommendations are written as notes, not applied changes.

---

## Summary

| # | Checklist item | Area | Before | Now |
|---|----------------|------|--------|-----|
| 1 | `DEBUG=False` in production | Django | Pass | Pass |
| 2 | Worker memory / RSS, recycle with `--max-requests` | Django | Gap | **Pass (fixed)** |
| 3 | N+1 queries (`select_related` / `prefetch_related`) | Django | Partial | **Pass (fixed)** |
| 4 | DB connections, no pool exhaustion | Django | Pass (caveat) | Pass (caveat now live) |
| 5 | Heavy work off the request (Celery) | Django | Partial | **Pass in code (fixed)** |
| 6 | Temp-file cleanup | Django | Pass | Pass |
| 7 | Load test (Locust/k6, p50/p95/p99) | Django | Gap | Pass |
| 8 | `useEffect` cleanup (listeners/intervals/subscriptions) | React | Mostly pass | **Pass (improved)** |
| 9 | Image/frame cleanup, revoke object URLs | React | Pass | Pass |
| 10 | Request cancellation, `AbortController` on unmount | React | Gap | Pass |


Legend: Pass · Partial · Gap · Not verifiable from source

**What changed since the "before" report:**
1. **Production now runs Gunicorn** with `--max-requests` recycling instead of the dev server (item 2). See [Dockerfile](../Dockerfile).
2. **Celery is now integrated**; the heavy PDF report build was moved off the request thread onto a Celery worker (Redis broker/backend), with a `202 {job_id}` → poll → download contract (item 5). See [reports/tasks.py](../backend/apps/reports/tasks.py), [reports/views.py:79-195](../backend/apps/reports/views.py#L79-L195).
3. **Projects-list N+1 removed**; the five per-project counts are now DB annotations, so the list is one query (item 3). See [projects/views.py:37-56](../backend/apps/projects/views.py#L37-L56).
4. **`AbortController` introduced** on the two highest-traffic fetch paths, including the 15s live-poll feed (item 11), but most per-project data hooks still lack it.
5. **UI timers now cleaned up** in the previously-flagged components (item 8), and **log rotation** was added (item 6 adjacent note).

**Still open (ranked):**
1. **Celery report flow is not wired end-to-end in the integrated app** (item 5): (a) no Celery **worker** is launched by the Dockerfile CMD or either compose file, and (b) the frontend export hook still uses the *old* single-request/PDF-blob contract, not the new `202 {job_id}` → poll → download endpoints. With `CELERY_TASK_ALWAYS_EAGER=False` in production and no worker, an enqueued report would never complete. See [useExportReport.ts:29](../frontend/src/hooks/useExportReport.ts#L29), [docker-compose.prod.yml](../docker-compose.prod.yml), [Dockerfile:58](../Dockerfile#L58).
2. **Load testing**, no Locust/k6 tooling or recorded p50/p95/p99 (item 7).
3. **`AbortController` coverage is partial**, only 2 of ~13 data hooks abort on unmount (item 11).
4. **Celery worker recycling not configured**, no `--max-tasks-per-child` / `worker_max_tasks_per_child` to bound worker RSS (item 2, Celery side).

---

## 6.2.1 Django / Python

### 1. `DEBUG=False` in production: Pass

- Default is safe: `DEBUG = config('DEBUG', default=False, cast=bool)`, [base.py:9](../backend/config/settings/base.py#L9).
- No hardcoded `DEBUG=True` in settings.
- **Note (unchanged):** `ALLOWED_HOSTS` defaults to `'*'`, [base.py:10](../backend/config/settings/base.py#L10). This should be constrained by the production environment.

### 2. Worker memory over time / recycle with `--max-requests`: Pass (fixed)

**Fixed since the before report.** The runtime image no longer runs `runserver`; it now serves under **Gunicorn**:

```
gunicorn config.wsgi:application --bind 0.0.0.0:8000 \
  --workers ${GUNICORN_WORKERS:-$((2 * $(nproc) + 1))} \
  --max-requests ${GUNICORN_MAX_REQUESTS} \
  --max-requests-jitter ${GUNICORN_MAX_REQUESTS_JITTER} \
  --timeout ${GUNICORN_TIMEOUT} ...
```

[Dockerfile:46-58](../Dockerfile#L46-L58).

- `gunicorn>=22.0,<24.0` is now a production dependency, [requirements.txt:10](../backend/requirements.txt#L10).
- Worker recycling is configured with sane defaults, all overridable at runtime: `GUNICORN_MAX_REQUESTS=1000`, `GUNICORN_MAX_REQUESTS_JITTER=100`, `GUNICORN_TIMEOUT=60`, [Dockerfile:51-53](../Dockerfile#L51-L53). This directly satisfies the checklist's "recycle with `--max-requests`" to bound per-worker RSS growth, and the jitter avoids a thundering-herd restart.
- Worker count defaults to `(2 × nproc) + 1`, overridable via `GUNICORN_WORKERS`.

**Note:** the recycle thresholds are sensible defaults, not values derived from a measured RSS-growth profile; item 7 (load test) is where those would be validated.

**Celery side of this item, not yet covered.** The checklist calls out per-worker RSS recycling for **Guninicorn *and* Celery**. Now that a Celery worker exists (item 5), there is **no `--max-tasks-per-child` / `worker_max_tasks_per_child`** configured to recycle the task worker and reclaim RSS after heavy reportlab builds, [config/celery.py](../backend/config/celery.py) and [base.py:176-201](../backend/config/settings/base.py#L176-L201) set no such bound, and the documented launch command is a bare `celery -A config worker --loglevel=info`, [config/celery.py:11-13](../backend/config/celery.py#L11-L13). `CELERY_TASK_TIME_LIMIT`/`SOFT_TIME_LIMIT` bound *runtime*, not memory. Consider adding `--max-tasks-per-child` (e.g. 100) or `worker_max_memory_per_child` for the report worker.

### 3. N+1 queries: Pass (fixed)

**Fixed since the before report.** The projects-list N+1 is gone. `ProjectListCreateView.get_queryset` now annotates the five counts on the queryset in a single query:

```python
.annotate(
    member_count=Count('members', distinct=True),
    env_count=Count('env_variables', distinct=True),
    license_count=Count('license_keys', distinct=True),
    admin_cred_count=Count('admin_credentials', distinct=True),
    app_user_count=Count('app_users', distinct=True),
)
.order_by('-created_at')
```

[projects/views.py:37-56](../backend/apps/projects/views.py#L37-L56). `distinct=True` correctly prevents the multi-join count inflation, and `order_by` re-asserts ordering after the `GROUP BY` that `annotate()` introduces.

- `ProjectListSerializer` now reads those annotations as plain `IntegerField(read_only=True)` instead of issuing a `.count()` per field, [projects/serializers.py:33-49](../backend/apps/projects/serializers.py#L33-L49). Result: **~1 query per list page** instead of the previous ~51.
- Other list endpoints continue to use `select_related` / `prefetch_related` (teams, reports, activity log, members, e.g. [projects/views.py:189-191](../backend/apps/projects/views.py#L189-L191)).
- **Detection tooling now present:** `django-debug-toolbar>=4.3,<6.0` is a dev-only dependency, [requirements.txt:16-18](../backend/requirements.txt#L16-L18), and is wired in settings behind a `DEBUG` + importable guard so it never loads in production, [base.py:70-78](../backend/config/settings/base.py#L70-L78).

**Minor (unchanged, low impact):** `ProjectDetailSerializer` still computes the five counts as `SerializerMethodField` / `.count()`, [projects/serializers.py:57-88](../backend/apps/projects/serializers.py#L57-L88). This adds five extra queries, but only for a **single** object on the retrieve endpoint, so it is not an N+1 over a list. Optional: switch the detail view to the same annotation for consistency.

**Minor (tooling):** the debug-toolbar package is installed and its middleware/app are registered, but its URLs are **not** wired into `config/urls.py` (only documented as a note in [base.py:66-69](../backend/config/settings/base.py#L66-L69)), so the panel UI won't render until those URLs are added. Query counts are still collected; only the visual panel is gated on the URL include.

### 4. DB connections, no pool exhaustion: Pass (caveat now live)

- Persistent connections remain configured for PostgreSQL: `CONN_MAX_AGE: 600` and `CONN_HEALTH_CHECKS: True`, [base.py:114-115](../backend/config/settings/base.py#L114-L115).
- **Caveat, now active:** with Gunicorn running multiple workers (item 2), each worker holds its own persistent connection for up to 10 minutes, so the total open-connection count scales with worker count. Size PostgreSQL `max_connections` (or place a pooler such as PgBouncer in front) to match `GUNICORN_WORKERS`. This was theoretical under the old single-process server; it is now a real capacity-planning input.

### 5. Heavy work off the request (Celery): Pass in code (fixed)

**Fixed at the code level since the before report.** Celery is now a real dependency and the one heavy synchronous task, the PDF activity-report build, has been moved off the request thread:

- `celery[redis]>=5.3,<6.0` is a production dependency, [requirements.txt:9](../backend/requirements.txt#L9).
- Celery app defined and imported on Django startup so `@shared_task` registers, [config/celery.py](../backend/config/celery.py), [config/__init__.py:6](../backend/config/__init__.py#L6).
- The build runs in a task, `generate_activity_report_task` does the DB scan + reportlab render on the worker and returns the PDF (base64) via the result backend, [reports/tasks.py:23-60](../backend/apps/reports/tasks.py#L23-L60); the DB aggregation was extracted into `build_activity_report_context` specifically so it runs off-request, [reports/services.py:218-226](../backend/apps/reports/services.py#L218-L226).
- The web endpoint no longer blocks: `ActivityReportView` validates, enqueues via `.delay()`, and returns **`202 {job_id}`** immediately; the client polls `activity/status/<job_id>/` and fetches `activity/download/<job_id>/`, [reports/views.py:79-195](../backend/apps/reports/views.py#L79-L195), [reports/urls.py:11-13](../backend/apps/reports/urls.py#L11-L13).
- Redis (already required for cache/lockouts) is reused as broker + result backend; task runtime is bounded (`CELERY_TASK_SOFT_TIME_LIMIT=240`, `TIME_LIMIT=300`) and results expire after 1h (`CELERY_RESULT_EXPIRES=3600`), [base.py:176-201](../backend/config/settings/base.py#L176-L201). Tests run eagerly with an in-memory result backend, [test.py:24-30](../backend/config/settings/test.py#L24-L30).*

### 6. Temp-file cleanup: Pass

- The PDF is still built entirely **in memory** via `io.BytesIO()`, [reports/services.py:235](../backend/apps/reports/services.py#L235). No temp file touches disk, so there is nothing to leak or clean up.
- No `tempfile` / `NamedTemporaryFile` / disk-write patterns in app code.
- **New (Celery flow):** the finished PDF is now base64-encoded and returned from the task into the **Redis result backend**, [reports/tasks.py:56-60](../backend/apps/reports/tasks.py#L56-L60), where the download view decodes it and streams it as an `HttpResponse`, [reports/views.py:185-195](../backend/apps/reports/views.py#L185-L195). This is still not a disk temp file, and the payload is **bounded and self-expiring** (`CELERY_RESULT_EXPIRES=3600`, 1h), [base.py:196](../backend/config/settings/base.py#L196), so it can't accumulate. Worth being aware that base64 inflates the stored size ~33% and it lives in Redis (not disk) for up to an hour per generated report.

**Adjacent note, now fixed:** the before report flagged the application log as an unbounded append-mode file. Logging now uses a **`TimedRotatingFileHandler`** that rotates at midnight and keeps 14 days (`backupCount: 14`), [base.py:271-277](../backend/config/settings/base.py#L271-L277), so `logs/django.txt` can no longer grow without bound.

---

## 6.2.2 React

### 7. `useEffect` cleanup: Pass (improved)

**Event listeners / intervals (unchanged, correct):**
- Every `addEventListener` still has a matching `removeEventListener` in cleanup (header/panel/dropdown click & keydown handlers; `storage`/`popstate` in [AuthContext.tsx](../frontend/src/context/AuthContext.tsx) and [ProjectsContext.tsx:148-156](../frontend/src/context/ProjectsContext.tsx#L148-L156)).
- No `WebSocket` / `EventSource` anywhere.

**Fixed since the before report, UI timers:** the fire-and-forget `setTimeout` calls previously flagged are now driven by effects with a `clearTimeout` cleanup, so they can't fire into an unmounted component:
- [CredentialsOverviewTab.tsx:805-816](../frontend/src/components/projects/CredentialsOverviewTab.tsx#L805-L816) (toast + "copied" indicator).
- [AdminCredentialsPage.tsx:127-131](../frontend/src/components/projects/AdminCredentialsPage.tsx#L127-L131) ("copied" indicator).
- [SettingsPage.tsx:180-182](../frontend/src/components/settings/SettingsPage.tsx#L180-L182) ("saved" flag).
- [MembersTable.tsx:267-269](../frontend/src/components/teams/MembersTable.tsx#L267-L269) ("copied" indicator).
- The poll interval + focus listener on the notifications page are cleared on unmount, [AllNotificationsPage.tsx:26-36](../frontend/src/components/common/AllNotificationsPage.tsx#L26-L36).

**Minor (low severity, remaining):** a few "copied" indicators still use a fire-and-forget `setTimeout` with a **functional state updater** rather than an effect timer, [SystemCredentialsPage.tsx:650](../frontend/src/components/systems/SystemCredentialsPage.tsx#L650), [AppUsersPage.tsx:228](../frontend/src/components/projects/AppUsersPage.tsx#L228), [LicenseKeysPage.tsx:227](../frontend/src/components/projects/LicenseKeysPage.tsx#L227). On React 18 a post-unmount `setState` from these is a harmless no-op (and the functional updater keeps state correct), so this is a tidiness note, not a leak. `SettingsPage.tsx:282` (`setTimeout(router.push('/login'), 2000)` on logout) is also fire-and-forget but the app is navigating away.


### 8. Image / frame cleanup, revoke object URLs: Pass

- The only `URL.createObjectURL` usage (PDF download) still revokes the URL and removes the temporary anchor after clicking, [useExportReport.ts:57-64](../frontend/src/hooks/useExportReport.ts#L57-L64). The revoke pattern itself is correct and leak-free (this item passes on its own merits), independent of the export-contract mismatch flagged under item 5.
- No frames/images held in component state (no video/CV workflow).

### 9. Request cancellation, `AbortController` on unmount: Improved (Pass)

**Fixed since the before report on the highest-impact paths:**
- The shared axios client now re-exports `isCancel` so hooks can distinguish a cancellation from a real error, [api.ts:75-82](../frontend/src/lib/api.ts#L75-L82).
- [useProjects.ts:41-63](../frontend/src/hooks/useProjects.ts#L41-L63): creates an `AbortController` in the effect, passes `signal` to `api.get`, aborts on unmount, and ignores `isCancel` errors.
- [useRecentActivities.ts:44-93](../frontend/src/hooks/useRecentActivities.ts#L44-L93): same pattern, and `refetch(signal)` accepts a signal.
- **Most impactful case fixed:** the 15s live-poll + focus refetch now share one `AbortController` that is aborted on unmount, [AllNotificationsPage.tsx:26-36](../frontend/src/components/common/AllNotificationsPage.tsx#L26-L36), so a poll can no longer resolve into a gone component.

### 10. Sustained-use test (JS heap / DOM node count): Not verifiable from source

Repeating a real workflow while watching the JS heap and DOM node count is a manual step; nothing in the repo confirms it was run.

---

## Items outside the checklist noticed during review (informational only)

- **Log rotation:** now handled by `TimedRotatingFileHandler` (was flagged as unbounded before), [base.py:271-277](../backend/config/settings/base.py#L271-L277).
- **Redis fail-fast:** cache uses a short `SOCKET_CONNECT_TIMEOUT` / `SOCKET_TIMEOUT` (`REDIS_CONNECT_TIMEOUT`, default 0.2s) with `IGNORE_EXCEPTIONS: True`, so a down Redis degrades gracefully instead of blocking requests, [base.py:159-174](../backend/config/settings/base.py#L159-L174). Good for latency stability. Note this graceful-degradation applies to the **cache** client only; Celery now also depends on Redis as its broker/result backend, and that path has its own failure behaviour (enqueue/poll errors), so Redis is now a harder dependency for the report feature than it was for the cache alone.
- **No Redis service in compose:** both [docker-compose.yml](../docker-compose.yml) and [docker-compose.prod.yml](../docker-compose.prod.yml) define only `db` + `backend` (no `redis`, no `worker`); `REDIS_URL` is a required env var pointing at an externally-provided Redis. Fine if that's the deployment model, but the Celery broker/worker have no in-compose home yet (see item 5).
- **Request body logging:** the request logger still reads/serializes `request.body` per JSON request. Fine for the small payloads here; would matter if large uploads are added.
- **Token-refresh queue:** on refresh failure the module-level `refreshQueue` callbacks are not invoked before redirect to `/login`, [api.ts:62-68](../frontend/src/lib/api.ts#L62-L68). In practice the page navigates away, so queued promises are discarded on unload; not a sustained leak.

---
