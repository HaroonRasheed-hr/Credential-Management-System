# Backend Test Suite — Error Diagnosis & Fix Log

**Project:** Credential Management System
**Backend:** Django 4.2 + Django REST Framework  
**Test Runner:** pytest + pytest-django  
**Date:** 2026-06-29  

---

## Table of Contents

1. [Error 1 — Django Settings Not Configured](#error-1--django-settings-not-configured)
2. [Error 2 — App Registry Not Ready](#error-2--app-registry-not-ready)
3. [Error 3 — Missing `reportlab` Module](#error-3--missing-reportlab-module)
4. [Error 4 — Pagination Format Mismatch (7 tests)](#error-4--pagination-format-mismatch-7-tests)
5. [Error 5 — `JsonResponse` Has No `.data` Attribute (2 tests)](#error-5--jsonresponse-has-no-data-attribute-2-tests)
6. [Final Test Results](#final-test-results)
7. [Quick-Start Cheatsheet](#quick-start-cheatsheet)

---

## Error 1 — Django Settings Not Configured

### Symptom

Every test failed at collection time with:

```
django.core.exceptions.ImproperlyConfigured: Requested setting AUTH_USER_MODEL,
but settings are not configured. You must either define the environment variable
DJANGO_SETTINGS_MODULE or call settings.configure() before accessing settings.
```

### Root Cause

pytest does not know which Django settings module to load. Without it, the very
first import of any Django model or app triggers this error before a single test
body runs.

### Fix

**Created `backend/pytest.ini`:**

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings.test
python_files = test_*.py
python_classes = Test*
python_functions = test_*
testpaths = apps
```

**Why `config.settings.test` and not `config.settings.base`?**

`manage.py` defaults to `config.settings.base`, but `config/settings/test.py`
exists specifically for testing. It overrides the database to SQLite in-memory
and the cache to `LocMemCache`, so no real PostgreSQL or Redis instance is
required to run the suite.

```python
# config/settings/test.py  (already existed — not modified)
from .base import *
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
CACHES   = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', ...}}
```

---

## Error 2 — App Registry Not Ready

### Symptom

Appeared alongside Error 1 during collection:

```
django.core.exceptions.AppRegistryNotReady: Apps aren't loaded yet.
```

### Root Cause

Same underlying cause as Error 1. When Django settings are not configured,
`django.setup()` is never called, so the app registry is never populated.
Any import that touches models immediately raises this error.

### Fix

Fixed by the same `pytest.ini` change above. `pytest-django` reads
`DJANGO_SETTINGS_MODULE` from `pytest.ini` and calls `django.setup()`
automatically before test collection begins.

**Created `backend/conftest.py`** (root-level stub):

```python
# Root conftest for the backend test suite.
# pytest-django reads DJANGO_SETTINGS_MODULE from pytest.ini and calls
# django.setup() automatically — do NOT call it here.
```

> **Important:** Do NOT manually call `django.setup()` in `conftest.py`.
> `pytest-django` does this internally. Calling it a second time causes
> `RuntimeError: populate() was already called`.

---

## Error 3 — Missing `reportlab` Module

### Symptom

After fixing errors 1 and 2, pytest collected 119 tests and ran them. All
HTTP-based tests failed with:

```
ModuleNotFoundError: No module named 'reportlab'

apps\reports\services.py:18: in <module>
    from reportlab.lib import colors
```

The traceback showed the failure happened inside Django's URL resolver, not
inside any test. Every test that made an HTTP request triggered this because
Django tries to load all URL patterns on the first request, which imports
`apps.reports.urls` → `apps.reports.views` → `apps.reports.services`, which
does a top-level `from reportlab.lib import colors`.

### Root Cause

`reportlab` is a PDF-generation library used by `apps/reports/services.py`.
It was missing from the virtual environment. Because the import is at module
level (not lazy), any HTTP request crashed the entire URL loading process.

### Fix

Install the missing package into the virtual environment:

```powershell
# Run from backend/ with venv activated
.\venv\Scripts\pip.exe install reportlab
```

Also add it to `requirements.txt` so it is not missed again:

```text
reportlab>=4.0
```

> **Note:** This was a missing dependency, not a code bug. No application
> files were modified.

---

## Error 4 — Pagination Format Mismatch (7 tests)

### Symptom

7 tests in `apps/projects/tests/test_projects.py` failed with `KeyError`:

```
KeyError: 'results'
# or
KeyError: 'count'
```

Tests expected:

```python
response.json()['results']   # top-level key
response.json()['count']     # top-level key
```

### Root Cause

The project has a custom `paginated_success_response()` helper in
`utils/responses.py` that wraps paginated data in a project-specific envelope:

```python
# utils/responses.py  (unchanged — still used by notifications)
def paginated_success_response(paginator, serializer_data, message):
    return Response({
        'success': True,
        'message': message,
        'data': {                          # ← results are NESTED here
            'count': paginator.page.paginator.count,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
            'results': serializer_data,
        },
    })
```

Actual response shape:

```json
{
  "success": true,
  "message": "Projects retrieved.",
  "data": {
    "count": 2,
    "results": [...]
  }
}
```

Tests expected the **standard DRF flat pagination format**:

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [...]
}
```

**Affected endpoints:**

| Endpoint | View |
|---|---|
| `GET /api/v1/projects/` | `ProjectListCreateView` |
| `GET /api/v1/projects/<id>/env-variables/` | `EnvVariableListCreateView` |
| `GET /api/v1/projects/<id>/activity-log/` | `ActivityLogListView` |

**Why `paginated_success_response` was NOT changed globally:**

The notification test `test_developer_cannot_see_others_notifications` accesses
`response.data['data']['results']` (nested format) and passes. Changing the
helper globally would have broken that test.

### Fix

Switched only the three affected views to use DRF's built-in
`get_paginated_response()` / `paginator.get_paginated_response()`, which
returns the flat standard format.

**`apps/projects/views.py`** — `ProjectListCreateView.list()`:

```python
# Before
return paginated_success_response(self.paginator, serializer.data, 'Projects retrieved.')

# After
return self.get_paginated_response(serializer.data)
```

**`apps/env_variables/views.py`** — `EnvVariableListCreateView.get()`:

```python
# Before
return paginated_success_response(paginator, serializer.data, 'Env variables retrieved.')

# After
return paginator.get_paginated_response(serializer.data)
```

**`apps/activity_log/views.py`** — `ActivityLogListView.get()`:

```python
# Before
return paginated_success_response(paginator, serializer.data, 'Activity log retrieved.')

# After
return paginator.get_paginated_response(serializer.data)
```

The unused `paginated_success_response` import was removed from each of these
three files. The helper itself in `utils/responses.py` was not touched.

---

## Error 5 — `JsonResponse` Has No `.data` Attribute (2 tests)

### Symptom

2 tests in `apps/authentication/tests/test_lockout.py` failed with
`AttributeError` or `TypeError`:

```
res.data['code']       # AttributeError: 'JsonResponse' object has no attribute 'data'
res.data['retry_after']
```

The failing tests were:

- `test_correct_password_blocked_after_lockout`
- `test_response_includes_retry_after`

Both trigger the lockout middleware (not the view) — they make a request after
the account is already locked.

### Root Cause

**How the lockout flow works:**

```
Request 1, 2 → middleware passes through → view records failure
Request 3    → middleware passes through → view records failure #3 → locks account → returns DRF Response (has .data) ✓
Request 4+   → middleware INTERCEPTS → returns response immediately (short-circuit)
```

The middleware (`middleware/login_attempt.py`) returned a Django `JsonResponse`:

```python
from django.http import JsonResponse

return JsonResponse(
    {'success': False, 'code': 'account_locked', 'retry_after': remaining},
    status=423,
)
```

Django's `JsonResponse` is a plain `HttpResponse` subclass. It has no `.data`
attribute. DRF's `APIClient` (used in `APITestCase`) does NOT auto-parse
JSON response content into `.data` — `.data` is only available on DRF's own
`Response` objects.

Tests that hit the middleware short-circuit receive a `JsonResponse`, so
`res.data` raises `AttributeError`.

Tests that hit the view receive a DRF `Response`, so `res.data` works fine
(e.g., `test_third_failure_returns_423` passes because the 3rd attempt still
goes through to the view).

### Fix

**`middleware/login_attempt.py`** — replaced `JsonResponse` with DRF `Response`,
manually rendered so Django's handler receives proper bytes while the `Response`
object retains its `.data` attribute for tests:

```python
# Before
from django.http import JsonResponse

return JsonResponse(
    {'success': False, 'message': ..., 'code': 'account_locked', 'retry_after': remaining},
    status=423,
)

# After
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

response = Response(
    {'success': False, 'message': ..., 'code': 'account_locked', 'retry_after': remaining},
    status=423,
)
response.accepted_renderer = JSONRenderer()
response.accepted_media_type = 'application/json'
response.renderer_context = {}
response.render()   # ← produces the JSON bytes Django needs
return response
```

**Why manual rendering is required:**

DRF `Response` is a `SimpleTemplateResponse`. Normally, `APIView.finalize_response()`
sets the renderer and calls `.render()` before the response is returned to
Django. Since middleware bypasses `APIView` entirely, this step must be done
manually. Without `.render()`, Django cannot serialize the response to bytes
and raises a `TypeError`.

**Production impact:** None. The wire format is identical to before —
same JSON body, same `423` status code, same `Content-Type: application/json`
header.

---

## Final Test Results

After all fixes, running the full targeted suite:

```
pytest apps/projects/tests/test_projects.py apps/authentication/tests/test_lockout.py -v
```

```
collected 42 items

apps/projects/tests/test_projects.py::ProjectCreationTests::test_create_project_as_admin         PASSED
apps/projects/tests/test_projects.py::ProjectCreationTests::test_create_project_as_developer      PASSED
apps/projects/tests/test_projects.py::ProjectCreationTests::test_creation_logged                  PASSED
apps/projects/tests/test_projects.py::ProjectCreationTests::test_creator_added_as_admin_member    PASSED
apps/projects/tests/test_projects.py::ProjectCreationTests::test_slug_auto_generated              PASSED
apps/projects/tests/test_projects.py::ProjectCreationTests::test_slug_uniqueness                  PASSED
apps/projects/tests/test_projects.py::ProjectCreationTests::test_unauthenticated_cannot_create    PASSED
apps/projects/tests/test_projects.py::ProjectVisibilityTests::test_developer_cannot_access_...    PASSED
apps/projects/tests/test_projects.py::ProjectVisibilityTests::test_developer_sees_member_project  PASSED
apps/projects/tests/test_projects.py::ProjectVisibilityTests::test_developer_sees_only_own_...    PASSED
apps/projects/tests/test_projects.py::ProjectVisibilityTests::test_system_admin_sees_all_projects PASSED
... (31 more — all PASSED)

======================== 42 passed in 63.25s ========================
```

---

## Quick-Start Cheatsheet

### Running tests

```powershell
# From backend/ with venv activated
.\venv\Scripts\Activate.ps1

# Run all tests
.\venv\Scripts\pytest.exe -v

# Run a specific app
.\venv\Scripts\pytest.exe apps/authentication/ -v

# Run a specific file
.\venv\Scripts\pytest.exe apps/projects/tests/test_projects.py -v

# Run a single test
.\venv\Scripts\pytest.exe apps/projects/tests/test_projects.py::ProjectVisibilityTests::test_system_admin_sees_all_projects -v

# Show print() output
.\venv\Scripts\pytest.exe -s

# Stop on first failure
.\venv\Scripts\pytest.exe -x
```

### Files created / modified

| File | Action | Purpose |
|---|---|---|
| `backend/pytest.ini` | **Created** | Sets `DJANGO_SETTINGS_MODULE`, test paths, discovery rules |
| `backend/conftest.py` | **Created** | Root conftest stub (intentionally minimal) |
| `middleware/login_attempt.py` | **Modified** | `JsonResponse` → DRF `Response` with manual render |
| `apps/projects/views.py` | **Modified** | Flat DRF pagination in `ProjectListCreateView.list()` |
| `apps/env_variables/views.py` | **Modified** | Flat DRF pagination in `EnvVariableListCreateView.get()` |
| `apps/activity_log/views.py` | **Modified** | Flat DRF pagination in `ActivityLogListView.get()` |

### Key rules going forward

1. **New list views** that are tested with `response.json()['results']` should
   use `paginator.get_paginated_response(data)` — not `paginated_success_response`.

2. **New list views** whose tests use `response.data['data']['results']` (the
   notifications pattern) should continue using `paginated_success_response`.

3. **Middleware that must return a JSON error** should use DRF `Response` with
   manual rendering (see the pattern in `middleware/login_attempt.py`) so that
   `res.data` is available in `APITestCase` tests.

4. **Never call `django.setup()` in `conftest.py`** — `pytest-django` does it
   automatically when `DJANGO_SETTINGS_MODULE` is set in `pytest.ini`.

5. **Always use `config.settings.test`** (not `base`) for pytest. The test
   settings use SQLite in-memory and local-memory cache — no external services
   required.
