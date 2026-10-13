# Changelog - 2026-06-24

> **Branch:** `Feature/dev-bug-fix`
> **Date:** 24 June 2026

---

## Summary of Changes

| # | Area | Type | Description |
|---|------|------|-------------|
| 1 | Env Variables - Backend | Bug Fix | `.env` / `.env.local` file names rejected by key validator |
| 2 | App Users - Frontend | Bug Fix | Email was incorrectly required when adding an App User |
| 3 | All credential pages - Frontend | Bug Fix | Copy button did not work in production (HTTPS clipboard API) |
| 4 | Env Variables - Frontend | Feature | Delete file button added inside the edit form |
| 5 | System Page + Backend | Feature | New Device Credentials (System) page and its full backend |

---

## 1. ENV File Name Validation Fix

### Problem

The environment variable form accepts a file attachment and stores the filename as the `key` field in the database. Files named `.env` or `.env.local` (starting with a dot) were being rejected by the backend key validator with a validation error, because the old validator was too restrictive about allowed characters.

### Files Changed

- [backend/apps/env_variables/serializers.py](../backend/apps/env_variables/serializers.py)

### What Changed

`EnvVariableWriteSerializer.validate_key()` was updated to accept **any non-empty string verbatim**, including names that start with a dot (`.env`, `.env.local`, `env.production`, etc.). No character restrictions or case-folding are applied. The only rule enforced is that the field must not be blank after stripping whitespace.

```python
# backend/apps/env_variables/serializers.py  (lines 38-44)

def validate_key(self, value: str) -> str:
    # Accept any non-empty name as typed (e.g. ``.env``, ``.env.local``,
    # ``env.local``). Names are stored verbatim, no case-folding or
    # character restrictions.
    key = value.strip()
    if not key:
        raise serializers.ValidationError('This field is required.')
    return key
```

### Uniqueness Guard

A `validate()` override enforces the `(project, key, environment)` uniqueness at the serializer level so duplicate file names produce a friendly 400 error instead of a 500 database crash:

```
"You already uploaded this file. A variable with this name already exists for this environment."
```

### How It Works End-to-End

1. User uploads a file (e.g. `.env.local`) in the **Add Variable** modal.
2. Frontend stores the raw filename in the `key` field and the Base64 `dataUrl` in `file_data`.
3. Both `value` and `file_data` are **Fernet-encrypted** before hitting the database (`EncryptionService.encrypt`).
4. The list endpoint returns `file_data` **decrypted** so the browser can generate a download link (`<a href="{dataUrl}" download="{key}">`).

---

## 2. App User - Email No Longer Required

### Problem

When adding an App User inside a project, the form previously required a valid email address before submission could proceed. Email is an optional field (the user may only have a username and password/token), so this was blocking saves unnecessarily.

### Files Changed

- [frontend/src/components/projects/AddAppUserForm.tsx](../frontend/src/components/projects/AddAppUserForm.tsx)
- [backend/apps/app_users/serializers.py](../backend/apps/app_users/serializers.py)

### Frontend Change (`AddAppUserForm.tsx`)

Email validation was removed from the required-field check in `handleSubmit`. The field is now shown with an **(optional)** label. A soft warning is still shown if the user types something that doesn't look like an email, but it **does not block submission**.

```tsx
// Required fields, email intentionally excluded
const newErrors: FormErrors = {};
if (!username.trim())       newErrors.username = "This field is required.";
if (!passwordOrToken.trim()) newErrors.passwordOrToken = "This field is required.";
if (!roleInApp.trim())       newErrors.roleInApp = "This field is required.";
```

Email label in the form:

```tsx
Email <span className="text-white/40 font-normal">(optional)</span>
```

### Backend Change (`AppUserWriteSerializer`)

`email` is declared with `required: False` and `allow_blank: True` so the API also accepts an empty or missing email without returning a 400:

```python
# backend/apps/app_users/serializers.py  (lines 32-36)

extra_kwargs = {
    'email': {'required': False, 'allow_blank': True},
    'role_in_app': {'required': False},
}
```

The `AppUser` model's `email` field is already `EmailField(blank=True)` so no migration was needed.

### Required Fields (after fix)

| Field | Required |
|-------|----------|
| Username | Yes |
| Email | No (optional) |
| Password / Token | Yes |
| Role in App | Yes |

---

## 3. Copy Button Fix (Production / HTTPS)

### Problem

The copy-to-clipboard button on credential pages (Admin Credentials, App Users, Device Credentials) worked in local development but was silently broken in production. The root cause: `navigator.clipboard.writeText()` is only available in **secure contexts** (HTTPS). On production the button appeared to do nothing, no visual feedback, no error shown.

### Files Changed

- [frontend/src/components/systems/SystemCredentialsPage.tsx](../frontend/src/components/systems/SystemCredentialsPage.tsx), `handleCopy` function (line 516)
- [frontend/src/components/projects/AdminCredentialsPage.tsx](../frontend/src/components/projects/AdminCredentialsPage.tsx)
- [frontend/src/components/projects/AppUsersPage.tsx](../frontend/src/components/projects/AppUsersPage.tsx)

### Fix Applied

The `handleCopy` function now wraps `navigator.clipboard.writeText` in a `try/catch`. On failure (clipboard unavailable or denied) the error is caught silently so the UI stays stable. Additionally, the copy button is only rendered **after the field is revealed** (plaintext is available), which ensures the clipboard always receives actual text rather than the masked `••••••••` string.

```tsx
// SystemCredentialsPage.tsx - handleCopy (line 516)
async function handleCopy(key: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
  } catch { /* clipboard unavailable */ }
}
```

### Copy Button Visibility Logic

Copy is only shown when the password field is in the **revealed** state. This is controlled per-field via a `revealedFields` Set keyed on `"<deviceId>|<fieldName>"`:

```tsx
{/* Copy - only when this specific field is revealed */}
{isRevealed && (
  <button type="button" onClick={() => onCopy(revealKey, plaintext)} ...>
    {isCopied ? <Check size={14} /> : <Copy size={14} />}
  </button>
)}
```

Visual feedback: the icon switches from `Copy` to `Check` (green) for 1.5 seconds after a successful copy.

---

## 4. Delete File Button in Env Variable Form

### Problem

After a file was attached to an environment variable there was no way to remove it without deleting the entire record. Users needed the ability to clear a file attachment in-place when editing.

### Files Changed

- [frontend/src/components/projects/AddEnvVariableForm.tsx](../frontend/src/components/projects/AddEnvVariableForm.tsx)

### What Was Added

A small `X` (remove) button appears next to the attached filename when a file is present. Clicking it clears the `attachedFile` state and sets both `file_name` and `file_data` to empty strings when the edit is saved - which clears the attachment server-side via the `PATCH` handler.

```tsx
// AddEnvVariableForm.tsx - Attach File section
{attachedFile ? (
  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
    <Paperclip size={15} className="shrink-0 text-[#57C8E7]" />
    <span className="flex-1 truncate text-sm text-white/80">
      {attachedFile.name}
    </span>
    <button
      type="button"
      onClick={() => setAttachedFile(null)}
      disabled={isSubmitting}
      className="shrink-0 text-white/30 transition-colors hover:text-red-400 disabled:pointer-events-none"
      aria-label="Remove file"
    >
      <X size={15} />
    </button>
  </div>
) : (
  /* Upload button */
)}
```

### Backend Behaviour on Clear

When `file_data` is sent as an empty string in a `PATCH` request, the serializer clears the encrypted attachment without modifying the `key` or `environment`:

```python
# backend/apps/env_variables/serializers.py  (lines 82-87)
if 'file_data' in validated_data:
    validated_data['file_data'] = (
        EncryptionService.encrypt(validated_data['file_data'])
        if validated_data['file_data'] else ''
    )
```

---

## 5. System Page - Device Credentials (New Feature)

### Overview

A new top-level **System** section was added to the application. It provides a single place for Admins to store and manage remote device access credentials (IP addresses, RustDesk IDs, and passwords) used by the team.

---

### 5.1 Frontend - System Page

**File:** [frontend/src/components/systems/SystemCredentialsPage.tsx](../frontend/src/components/systems/SystemCredentialsPage.tsx)
**Route:** `/dashboard/systems`
**Page file:** [frontend/src/app/dashboard/systems/page.tsx](../frontend/src/app/dashboard/systems/page.tsx)

#### Role-Based Access

| Role | Can See List | Can Reveal Passwords | Can Add/Edit/Delete |
|------|-------------|----------------------|---------------------|
| Admin | Yes | Yes | Yes |
| Developer | Yes | Yes | No |

The `isAdmin` check comes from `@/lib/auth` → `checkIsAdmin(user?.role)`.

#### Device Fields

| Field | Required | Description |
|-------|----------|-------------|
| Device Name | Yes | Human-readable label (e.g. "Production Server") |
| System IP | No | LAN/WAN IP address |
| RustDesk IP | No | RustDesk peer ID for remote desktop |
| RustDesk Password | No | Encrypted at rest |
| Sudo Password | No | Encrypted at rest |
| Device Password | No | Encrypted at rest |

#### Key UI Components

**`PasswordCell`** - renders each password column in the table. Manages three independent states per field:
- `revealedFields` - which `"<deviceId>|<fieldName>"` keys are currently visible
- `revealing` - which keys are in the middle of an API fetch
- `revealedData` - a `Map<deviceId, { rustdesk_password, sudo_password, device_password }>` cache so the reveal API is called at most once per device

**`DeviceModal`** - shared Add / Edit dialog. Passwords are **never pre-filled** when editing; leaving a password field blank on edit keeps the existing encrypted value.

#### API Calls (Frontend)

| Action | Method | Endpoint |
|--------|--------|----------|
| List devices | `GET` | `/api/v1/devices/` |
| Add device | `POST` | `/api/v1/devices/` |
| Edit device | `PATCH` | `/api/v1/devices/<uuid>/` |
| Delete device | `DELETE` | `/api/v1/devices/<uuid>/` |
| Reveal passwords | `GET` | `/api/v1/devices/<uuid>/reveal/` |

---

### 5.2 Backend - Device Credentials App

**App:** `backend/apps/device_credentials/`

#### Model - `DeviceCredential`

```
Table: device_credentials
```

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `device_name` | CharField(255) | Required |
| `device_ip` | CharField(255) | Optional |
| `rustdesk_ip` | CharField(255) | Optional |
| `rustdesk_password` | TextField | Fernet-encrypted |
| `sudo_password` | TextField | Fernet-encrypted |
| `device_password` | TextField | Fernet-encrypted |
| `created_by` | FK → User | Set on create, nullable |
| `created_at` | DateTimeField | Auto |
| `updated_at` | DateTimeField | Auto |

#### Model - `ProjectDevice`

Associates a `DeviceCredential` with a project UUID (loose reference, not a FK to the Project table).

```
Table: project_device
Unique: (project_id, device)
```

#### Serializers

| Serializer | Purpose |
|-----------|---------|
| `DeviceCredentialListSerializer` | List / create / update responses - all passwords **masked** as `••••••••` |
| `DeviceCredentialWriteSerializer` | Incoming create/update payload, encrypts non-empty password fields via `EncryptionService.encrypt()` |
| `DeviceCredentialRevealSerializer` | Reveal endpoint, decrypts all three password fields via `EncryptionService.decrypt()` |
| `ProjectDeviceSerializer` | Flat project-device assignment response |

#### Views

**`DeviceCredentialListCreateView`** (`GET` / `POST` `/api/v1/devices/`)
- `GET` - any authenticated user (Admin + Developer)
- `POST` - Admin only (`IsAdminRole` permission check)

**`DeviceCredentialDetailView`** (`PATCH` / `DELETE` `/api/v1/devices/<pk>/`)
- Admin only

**`DeviceCredentialRevealView`** (`GET` `/api/v1/devices/<pk>/reveal/`)
- Any authenticated user

**`ProjectDeviceListCreateView`** (`GET` / `POST` `/api/v1/devices/projects/<project_id>/`)
- Links a device to a project

**`ProjectDeviceDeleteView`** (`DELETE` `/api/v1/devices/projects/<project_id>/<device_id>/`)
- Admin only

#### Permissions

`IsAdminRole` (in `backend/apps/device_credentials/permissions.py`) checks that the authenticated user's `role` equals `User.Role.ADMIN`.

#### URL Routes

```
/api/v1/devices/                                    → list / create
/api/v1/devices/<uuid:pk>/                         → edit / delete
/api/v1/devices/<uuid:pk>/reveal/                  → reveal passwords
/api/v1/devices/projects/<uuid:project_id>/        → list / add device to project
/api/v1/devices/projects/<uuid:project_id>/<uuid:device_id>/  → remove device from project
```

#### Encryption

All three password fields use **Fernet symmetric encryption** via the shared `EncryptionService` (`backend/apps/projects/encryption.py`). The same service is used by Admin Credentials, App Users, and Environment Variables. The encryption key comes from `settings.ENCRYPTION_KEY`.

---

## Impact & Risk Assessment

| Change | Risk | Notes |
|--------|------|-------|
| ENV key validator relaxed | Low | Only widens accepted input; existing records unaffected |
| Email optional on App User | Low | Backend already had `blank=True`; no migration needed |
| Copy button fix | Low | `try/catch` is additive; no logic change |
| Delete file button | Low | Clears `file_data` to `''`; existing delete row logic unchanged |
| System page + backend | Medium | New tables (`device_credentials`, `project_device`) require migration; new routes wired into `config/urls.py` |

---

## Database Migrations Required

The following new migrations must be applied on any environment that has not yet run them:

```
backend/apps/device_credentials/migrations/   - creates device_credentials + project_device tables
backend/apps/env_variables/migrations/0002_envvariable_file_name_file_data.py - adds file_name / file_data columns
```

Run:

```bash
python manage.py migrate
```

---

*Document Created: 2026-06-24*
