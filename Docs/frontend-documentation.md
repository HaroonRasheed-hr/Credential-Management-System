# Frontend Documentation
## Project Credentials Management Portal

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Routing & Pages](#4-routing--pages)
5. [Authentication Flow](#5-authentication-flow)
6. [State Management (Contexts)](#6-state-management-contexts)
7. [Role-Based Access Control (RBAC)](#7-role-based-access-control-rbac)
8. [Data Layer & Storage](#8-data-layer--storage)
9. [Components Reference](#9-components-reference)
10. [TypeScript Types & Interfaces](#10-typescript-types--interfaces)
11. [Website User Flow](#11-website-user-flow)
12. [Cross-Tab Sync](#12-cross-tab-sync)

---

## 1. Overview

The frontend is a **client-side only** credentials management portal built with Next.js 15 and React 19. There is no backend API — all data is persisted in the browser via `localStorage` and `sessionStorage`. The application supports two user roles (Admin and Developer) with a full RBAC system, activity logging, and real-time cross-tab synchronization.

**Key characteristics:**
- No backend; all data lives in browser storage
- Role-based access control enforced at the component level
- React Context API for global state
- Tailwind CSS for styling (utility-first, responsive)
- TypeScript throughout with strict typing

---

## 2. Technology Stack

### Core Framework & Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | ^15.3.4 | React framework (App Router, SSR/CSR, routing) |
| **React** | ^19.1.0 | UI library |
| **React DOM** | ^19.1.0 | DOM rendering |
| **TypeScript** | ^5.8.3 | Static typing |

### Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | ^4.1.11 | Utility-first CSS framework |
| **@tailwindcss/postcss** | ^4.1.11 | PostCSS integration for Tailwind |

### UI Libraries

| Technology | Version | Purpose |
|------------|---------|---------|
| **Lucide React** | ^0.525.0 | Icon library (all icons in the app) |

### Developer Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **ESLint** | 9.39.4 | Code linting |
| **eslint-config-next** | ^15.5.19 | Next.js ESLint rules |
| **@types/node** | ^20.19.0 | Node.js type definitions |
| **@types/react** | ^19.1.8 | React type definitions |
| **@types/react-dom** | ^19.1.6 | React DOM type definitions |

### NPM Scripts

```bash
npm run dev     # Start development server
npm run build   # Production build
npm run start   # Start production server
npm run lint    # Run ESLint
```

---

## 3. Project Structure

```
frontend/
└── src/
    ├── app/                          # Next.js App Router pages
    │   ├── layout.tsx                # Root layout — wraps with <AuthProvider>
    │   ├── page.tsx                  # Root route — redirects to /login
    │   ├── globals.css               # Global CSS (Tailwind base + custom styles)
    │   ├── login/
    │   │   └── page.tsx              # Login page
    │   ├── forgot-password/
    │   │   └── page.tsx              # Forgot password page
    │   └── dashboard/
    │       ├── layout.tsx            # Dashboard layout — providers + AuthGuard
    │       ├── page.tsx              # Admin dashboard home
    │       ├── projects/
    │       │   ├── page.tsx          # Projects list page
    │       │   └── [projectId]/
    │       │       └── page.tsx      # Project detail page (dynamic route)
    │       ├── teams/
    │       │   └── page.tsx          # Teams management page
    │       ├── systems/
    │       │   └── page.tsx          # Device Credentials (System) page
    │       ├── notifications/
    │       │   └── page.tsx          # All notifications page
    │       └── settings/
    │           └── page.tsx          # Settings page
    │
    ├── components/
    │   ├── common/                   # Shared/reusable UI components
    │   │   ├── AuthGuard.tsx         # Route protection wrapper
    │   │   ├── DashboardHeader.tsx   # Top navigation bar
    │   │   ├── NotificationPanel.tsx # Bell icon + notification dropdown
    │   │   ├── ProfileDropdown.tsx   # User avatar + dropdown menu
    │   │   ├── Pagination.tsx        # Page navigation component
    │   │   ├── AllNotificationsPage.tsx  # Full-page notification feed
    │   │   └── Toaster.tsx           # Toast notification stack
    │   │
    │   ├── login/
    │   │   ├── LoginForm.tsx         # Email + password login form
    │   │   └── LoginScaleWrapper.tsx # Login page split layout
    │   │
    │   ├── projects/                 # Project management components
    │   │   ├── AddProjectForm.tsx    # Create / edit project modal
    │   │   ├── EditProjectForm.tsx   # Edit project modal
    │   │   ├── ProjectDetailOverview.tsx  # Tabbed project detail page
    │   │   ├── CredentialsOverviewTab.tsx  # Dev/Deployment system credentials tab
    │   │   ├── EnvironmentVariablesPage.tsx
    │   │   ├── LicenseKeysPage.tsx
    │   │   ├── AdminCredentialsPage.tsx
    │   │   ├── AppUsersPage.tsx
    │   │   ├── TeamPage.tsx
    │   │   ├── ActivityLogPage.tsx
    │   │   ├── TeamsPage.tsx         # Organization teams page
    │   │   ├── AddEnvVariableForm.tsx
    │   │   ├── AddLicenseKeyForm.tsx
    │   │   ├── AddAdminCredentialForm.tsx
    │   │   └── AddAppUserForm.tsx
    │   │
    │   ├── systems/
    │   │   └── SystemCredentialsPage.tsx  # Device Credentials page (Admin write / all read)
    │   │
    │   ├── Dashboard/
    │   │   ├── AdminDashboard.tsx    # Admin stats + overview
    │   │   └── Dashboard.tsx         # Projects card grid
    │   │
    │   ├── settings/
    │   │   └── SettingsPage.tsx      # User profile + password settings
    │   │
    │   └── ui/
    │       └── Input.tsx             # Reusable input component
    │
    ├── context/                      # React Context providers
    │   ├── AuthContext.tsx           # Authentication state
    │   ├── ProjectsContext.tsx       # Projects + team memberships
    │   ├── ActivityContext.tsx       # Activity log + notifications + toasts
    │   └── SearchContext.tsx         # Global search query state
    │
    ├── lib/
    │   ├── auth.ts                   # Auth types, seed users, storage helpers
    │   └── permissions.ts            # RBAC rules
    │
    ├── data/
    │   ├── projects.ts               # Project type definition + empty mock array
    │   └── notifications.ts          # Notification icon/color config
    │
    └── hooks/
        └── usePagination.ts          # Reusable pagination logic
```

---

## 4. Routing & Pages

The app uses the **Next.js 15 App Router** with a nested layout hierarchy.

### Layout Hierarchy

```
app/layout.tsx                  ← Root: wraps entire app with <AuthProvider>
└── app/dashboard/layout.tsx    ← Dashboard: wraps with ActivityProvider,
                                             ProjectsProvider, SearchProvider, AuthGuard
```

### All Routes

| Route | Page File | Component Rendered | Access |
|-------|-----------|-------------------|--------|
| `/` | `app/page.tsx` | Redirect → `/login` | Public |
| `/login` | `app/login/page.tsx` | `LoginForm` inside `LoginScaleWrapper` | Public |
| `/forgot-password` | `app/forgot-password/page.tsx` | Password recovery form | Public |
| `/dashboard` | `app/dashboard/page.tsx` | `AdminDashboard` | Admin only |
| `/dashboard/projects` | `app/dashboard/projects/page.tsx` | `Dashboard` (project cards) | All roles |
| `/dashboard/projects/[projectId]` | `app/dashboard/projects/[projectId]/page.tsx` | `ProjectDetailOverview` | Role-filtered |
| `/dashboard/teams` | `app/dashboard/teams/page.tsx` | `TeamsPage` | Admin only |
| `/dashboard/systems` | `app/dashboard/systems/page.tsx` | `SystemCredentialsPage` | All roles (write: Admin only) |
| `/dashboard/notifications` | `app/dashboard/notifications/page.tsx` | `AllNotificationsPage` | All roles |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | `SettingsPage` | All roles |

### Dynamic Route: Project Detail

`/dashboard/projects/[projectId]` receives `params.projectId` from the URL. The page:
1. Resolves the project from context using the ID
2. Calls `canViewProject(project)` — redirects to 404 if user lacks access
3. Renders `ProjectDetailOverview` with the resolved project

---

## 5. Authentication Flow

### Login Flow

```
User visits /
    │
    ▼
Redirect to /login
    │
    ▼
LoginForm renders
    │
    ▼
User submits email + password
    │
    ▼
useAuth().login(email, password)
    │
    ├─ Search accounts array for matching email
    ├─ Validate password
    ├─ Create SessionUser (Account without password field)
    └─ Save to sessionStorage (key: pcmp_session)
    │
    ▼
AuthContext sets user state
    │
    ▼
Redirect to /dashboard
    │
    ▼
AuthGuard confirms user exists → renders dashboard
```

### Logout Flow

```
User clicks "Sign Out" in ProfileDropdown
    │
    ▼
useAuth().logout()
    │
    ├─ Clear sessionStorage (pcmp_session)
    └─ Set user state to null
    │
    ▼
AuthGuard detects user === null
    │
    ▼
Redirect to /login
```

### Storage Strategy

| Data | Storage | Key | Lifetime |
|------|---------|-----|---------|
| User accounts (all) | `localStorage` | `pcmp_users` | Persists across browser restarts |
| Active session | `sessionStorage` | `pcmp_session` | Cleared when tab/browser closes |

### Seed Account (Demo)

On first load, if no accounts exist in localStorage, the following account is seeded:

```
Name:     H. Rasheed
Email:    hrasheed0702@gmail.com
Password: Zainbhai-07
Role:     Admin
```

> Note: Passwords are stored in plaintext — this is a demo/testing application only.

### AuthGuard Behavior

`AuthGuard` (`src/components/common/AuthGuard.tsx`) wraps all `/dashboard/*` routes:

1. While `loading === true` (hydrating from sessionStorage): renders a loading placeholder
2. If `user === null` after loading: calls `router.replace('/login')`
3. If `user` exists: renders children normally

---

## 6. State Management (Contexts)

All global state is managed via React Context API. There are four contexts, composed in the dashboard layout.

### Provider Composition (in `app/dashboard/layout.tsx`)

```tsx
<AuthProvider>           ← Root layout
  <ActivityProvider>     ← Dashboard layout
    <ProjectsProvider>
      <SearchProvider>
        <AuthGuard>
          {children}
        </AuthGuard>
      </SearchProvider>
    </ProjectsProvider>
  </ActivityProvider>
</AuthProvider>
```

---

### AuthContext (`src/context/AuthContext.tsx`)

**Purpose:** Manages user authentication and account registry.

**State:**

| Field | Type | Description |
|-------|------|-------------|
| `user` | `SessionUser \| null` | Currently logged-in user |
| `accounts` | `Account[]` | All registered accounts |
| `loading` | `boolean` | True while hydrating from storage |

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `login` | `(email, password) => boolean` | Authenticate and set session |
| `logout` | `() => void` | Clear session and redirect |
| `createUser` | `(input) => void` | Create new account (Admin only) |
| `removeUser` | `(id) => void` | Delete an account |

---

### ProjectsContext (`src/context/ProjectsContext.tsx`)

**Purpose:** Manages projects and project-level team memberships.

**State:**

| Field | Type | Description |
|-------|------|-------------|
| `projects` | `Project[]` | All projects in storage |
| `visibleProjects` | `Project[]` | Role-filtered projects for current user |
| `membersByProject` | `Record<number, ProjectMember[]>` | Team members keyed by project ID |

**Methods:**

| Method | Description |
|--------|-------------|
| `addProject(project)` | Create a new project (stamps creator identity) |
| `updateProject(updated)` | Edit an existing project |
| `deleteProject(projectId)` | Delete a project and its memberships |
| `getMembers(projectId)` | Get team members for a specific project |
| `assignMember(projectId, member)` | Add a user to a project team |
| `unassignMember(projectId, memberId)` | Remove a user from a project team |
| `canViewProject(project)` | Returns true if current user can access the project |

**Visibility Logic:**
- **Admin:** Sees all projects
- **Developer:** Sees projects they created OR are explicitly assigned to as a team member

**Storage Keys:** `pcmp_projects`, `pcmp_members`

---

### ActivityContext (`src/context/ActivityContext.tsx`)

**Purpose:** Manages the activity log, notifications, and in-app toast messages.

**State:**

| Field | Type | Description |
|-------|------|-------------|
| `activities` | `ActivityEntry[]` | All activity entries (filtered by role) |
| `unreadCount` | `number` | Number of unread notifications |
| `toasts` | `ActivityEntry[]` | Active toast pop-ups (max 3) |

**Methods:**

| Method | Description |
|--------|-------------|
| `log(input)` | Record a new activity event |
| `markAllRead()` | Mark all notifications as read |
| `markRead(id)` | Mark a single notification as read |
| `dismissToast(id)` | Remove a toast from the stack |

**Notification Routing:**

| Actor Role | Notified Roles |
|------------|---------------|
| Developer | Developer + Admin (flows upward) |
| Admin | Admin only |

**Storage Key:** `pcmp_activities` (sessionStorage — cleared on tab close)

---

### SearchContext (`src/context/SearchContext.tsx`)

**Purpose:** Shared search query state used by the header search bar and page-level filters.

**State:**

| Field | Type | Description |
|-------|------|-------------|
| `query` | `string` | Current search input value |

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `setQuery` | `(value: string) => void` | Update the search query |
| `matchesQuery` | `(query, ...fields) => boolean` | Check if any field contains the query (case-insensitive) |

---

## 7. Role-Based Access Control (RBAC)

### Roles

```typescript
type Role = "Admin" | "Developer";
```

### Role Hierarchy

```
SuperAdmin  (conceptual top)
    │
  Admin      ← Can see everything, manage all data
    │
Developer    ← Limited visibility; sees own/assigned items only
```

### RBAC Functions (`src/lib/permissions.ts`)

#### `canViewRecord(viewerRole, creatorRole)`

Controls whether a user can see a record created by another user.

| Viewer Role | Creator Role | Can View? |
|-------------|-------------|-----------|
| Admin | Admin | ✅ Yes |
| Admin | Developer | ✅ Yes |
| Developer | Developer | ✅ Yes |
| Developer | Admin | ❌ No |

#### `canReceiveNotification(viewerRole, actorRole)`

Controls whether a user sees a notification for an action taken by another user.

| Viewer Role | Actor Role | Receives? |
|-------------|-----------|-----------|
| Admin | Admin | ✅ Yes |
| Admin | Developer | ✅ Yes |
| Developer | Developer | ✅ Yes |
| Developer | Admin | ❌ No |

### Feature-Level Permissions

| Feature | Admin | Developer |
|---------|-------|-----------|
| View Admin Dashboard (`/dashboard`) | ✅ | ❌ (Access Restricted) |
| View all projects | ✅ | ❌ (own + assigned only) |
| Create projects | ✅ | ❌ |
| Edit projects | ✅ | ❌ |
| Delete projects | ✅ | ❌ |
| Manage teams (`/dashboard/teams`) | ✅ | ❌ |
| Add/remove team members | ✅ | ❌ |
| Add credentials (env vars, etc.) | ✅ | ❌ |
| View System page (`/dashboard/systems`) | ✅ | ✅ (read-only) |
| Add / Edit / Delete devices (System page) | ✅ | ❌ |
| Reveal device passwords (System page) | ✅ | ✅ |
| View notifications | ✅ All | ✅ Own scope |
| View settings | ✅ | ✅ |

---

## 8. Data Layer & Storage

### Architecture

This is a **100% client-side application** — there is no backend server or API. All data is stored and read from the browser's Web Storage API.

### Storage Map

| Data | Storage Type | Key | Notes |
|------|-------------|-----|-------|
| User accounts | `localStorage` | `pcmp_users` | Includes hashed passwords (demo plaintext) |
| Projects | `localStorage` | `pcmp_projects` | All project records |
| Project team memberships | `localStorage` | `pcmp_members` | Per-project member arrays |
| Organization teams | `localStorage` | `pcmp_teams` | Team definitions |
| Active session | `sessionStorage` | `pcmp_session` | Cleared on tab close |
| Activity log | `sessionStorage` | `pcmp_activities` | Cleared on tab close |

### Data Flow Pattern

```
Component action (e.g., "Create Project")
    │
    ▼
Context method called (addProject)
    │
    ├─ Update React state
    └─ Serialize + write to localStorage
    │
    ▼
storage event fires in other open tabs
    │
    ▼
Other tab contexts receive event, deserialize, update state
```

### Initial Seed Data

On first application load:
- **Accounts:** One admin account is seeded if `pcmp_users` is empty
- **Projects:** Empty array — all projects are user-created

---

## 9. Components Reference

### Common Components

#### `AuthGuard` (`src/components/common/AuthGuard.tsx`)
Route protection HOC. Checks auth state and redirects to `/login` if unauthenticated. Used in the dashboard layout to protect all `/dashboard/*` routes.

#### `DashboardHeader` (`src/components/common/DashboardHeader.tsx`)
Sticky top navigation bar containing:
- App logo
- Navigation links (Dashboard, Projects, Teams)
- Global search input (connected to SearchContext)
- Notification bell with unread badge (opens NotificationPanel)
- User avatar (opens ProfileDropdown)

#### `NotificationPanel` (`src/components/common/NotificationPanel.tsx`)
Dropdown panel triggered by the bell icon. Shows recent activity entries with read/unread state, timestamps, and a "Mark all read" action. Links to `/dashboard/notifications` for the full feed.

#### `ProfileDropdown` (`src/components/common/ProfileDropdown.tsx`)
User avatar dropdown with links to Settings, Help, and a "Sign Out" button.

#### `Pagination` (`src/components/common/Pagination.tsx`)
Reusable pagination component with smart ellipsis for large page counts. Powered by the `usePagination` hook.

#### `Toaster` (`src/components/common/Toaster.tsx`)
Fixed-position toast stack (bottom-right). Auto-dismisses after 4.5 seconds. Maximum 3 visible at once. Displays activity event messages.

#### `AllNotificationsPage` (`src/components/common/AllNotificationsPage.tsx`)
Full-page notification feed with filter tabs: All, Unread, Read. Includes bulk "Mark all read" action.

---

### Login Components

#### `LoginForm` (`src/components/login/LoginForm.tsx`)
Email and password form with:
- Client-side validation (empty field checks)
- Error message display
- Password visibility toggle
- Calls `useAuth().login()` on submit

#### `LoginScaleWrapper` (`src/components/login/LoginScaleWrapper.tsx`)
Two-panel login page layout:
- Left panel: Branding + illustration
- Right panel: Login card with `LoginForm`

---

### Dashboard Components

#### `AdminDashboard` (`src/components/Dashboard/AdminDashboard.tsx`)
Admin-only overview page (`/dashboard`). Contains:
- Stats cards (total projects, team members, credentials, active projects)
- Quick actions (Create Project, Invite Member, View Reports)
- Projects summary table
- Recent activity feed
- Team members list

Shows "Access Restricted" message for non-Admin users.

#### `Dashboard` (`src/components/Dashboard/Dashboard.tsx`)
Projects dashboard (`/dashboard/projects`). Contains:
- Paginated project card grid
- Status filter (All, Active, Archived)
- Search filtering
- "Add Project" button (Admin only)

---

### Project Components

#### `ProjectDetailOverview` (`src/components/projects/ProjectDetailOverview.tsx`)
Tabbed project detail page with 8 tabs:

| Tab | Component | Content |
|-----|-----------|---------|
| Overview | inline | Description, dates, creator, status, member count |
| Credentials Overview | `CredentialsOverviewTab` | Development & Deployment system credentials |
| Environment Variables | `EnvironmentVariablesPage` | Env var list + add form |
| License Keys | `LicenseKeysPage` | License key list + add form |
| Admin Credentials | `AdminCredentialsPage` | Admin credential list + add form |
| App Users | `AppUsersPage` | App user list + add form |
| Team | `TeamPage` | Project team members + assign form |
| Activity Log | `ActivityLogPage` | Project-specific activity entries |

#### `CredentialsOverviewTab` (`src/components/projects/CredentialsOverviewTab.tsx`)
Self-contained tab rendering two side-by-side credential cards — **Development** and **Deployment** — each holding a fixed set of system credential fields (System Name, System IP, Admin Password, RustDesk IP, RustDesk Password). Features:
- Per-section inline edit mode with Cancel / Save Changes actions and a "Saved!" toast
- Secret fields are masked by default with per-field reveal (eye) and copy-to-clipboard buttons; the System Name field is always shown in plain text
- Empty-state card with an "+ Add Credentials" prompt when a section has no values
- Backed by the `environment_credentials` API (`/api/v1/projects/{id}/environment-credentials/`)

#### `AddAppUserForm` (`src/components/projects/AddAppUserForm.tsx`)
Modal for adding or editing an App User inside a project.

**Required fields:** Username, Password / Token, Role in App.
**Optional fields:** Email — the field is labelled `(optional)` and does not block submission. A non-blocking soft warning appears if the entered value doesn't look like a valid email.

#### `AddEnvVariableForm` (`src/components/projects/AddEnvVariableForm.tsx`)
Modal for adding or editing an Environment Variable. Fields:

| Field | Required | Notes |
|-------|----------|-------|
| Name (`key`) | Yes | Any string accepted, including `.env`, `.env.local` |
| Attach File | Yes (add) / No (edit) | Base64-encoded and stored encrypted |
| Environment | Yes | Development / Staging / Production |

When a file is attached, an **X (remove) button** appears inline next to the filename. Clicking it clears the attachment; saving sends `file_name: ""` and `file_data: ""` to the API which clears the encrypted attachment server-side.

#### `AddProjectForm` (`src/components/projects/AddProjectForm.tsx`)
Modal for creating or editing projects. Create mode requires a password for the project vault. Edit mode is read-only on the project name.

#### `TeamsPage` (`src/components/projects/TeamsPage.tsx`)
Organization teams management (`/dashboard/teams`). Two-panel layout:
- Left: teams list
- Right: selected team detail with members table

---

### System Components

#### `SystemCredentialsPage` (`src/components/systems/SystemCredentialsPage.tsx`)

System-wide device credentials page (`/dashboard/systems`). Stores remote device access details used by the team — independent of any specific project.

**Role behaviour:**
- **Admin** — can Add / Edit / Delete devices; `Add Device` button and the Actions column (edit + delete) are visible.
- **Developer** — read-only; can view the list and reveal/copy passwords, but write controls are hidden.

**Key sub-components:**

| Sub-component | Purpose |
|---------------|---------|
| `PasswordCell` | Renders each password table column with independent reveal, copy, and loading states per field (`"<deviceId>\|<fieldName>"` key) |
| `DeviceModal` | Shared Add / Edit dialog. Passwords are never pre-filled on edit — leaving blank keeps the existing encrypted value |

**State management:**
- `revealedData` — `Map<deviceId, plaintext>` cache; the `/reveal/` API is called at most once per device per session.
- `revealedFields` — `Set<"<deviceId>\|<fieldName>">` tracking which specific password cells are currently visible.
- `revealing` — `Set<revealKey>` tracking which cells are mid-fetch.
- `copiedKey` — tracks the last copied field for 1.5 s visual feedback (`Copy` → `Check`).

**API endpoints used:**

| Action | Method | Endpoint |
|--------|--------|----------|
| List | `GET` | `/api/v1/devices/` |
| Create | `POST` | `/api/v1/devices/` |
| Update | `PATCH` | `/api/v1/devices/<uuid>/` |
| Delete | `DELETE` | `/api/v1/devices/<uuid>/` |
| Reveal | `GET` | `/api/v1/devices/<uuid>/reveal/` |

---

### Settings Component

#### `SettingsPage` (`src/components/settings/SettingsPage.tsx`)
User settings page (`/dashboard/settings`). Allows updating profile information and changing password.

---

### UI Primitives

#### `Input` (`src/components/ui/Input.tsx`)
Reusable form input with:
- Label support
- Error state display
- Password visibility toggle

---

## 10. TypeScript Types & Interfaces

### Authentication (`src/lib/auth.ts`)

```typescript
type Role = "Admin" | "Developer";

interface Account {
  id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
}

// Session user — Account without password
type SessionUser = Omit<Account, "password">;
```

### Project (`src/data/projects.ts`)

```typescript
interface Project {
  id: number;
  name: string;
  description: string;
  status: "Active" | "Archived";
  envVariables: number;
  licenseKeys: number;
  adminCredentials: number;
  teamMembers: number;
  createdDate: string;
  createdBy: string;
  createdById?: number;
  createdByRole?: Role;
  longDescription: string;
  password?: string;
}
```

### Project Membership (`src/context/ProjectsContext.tsx`)

```typescript
type ProjectRole = "Admin" | "Developer";

interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role: ProjectRole;
}
```

### Activity (`src/context/ActivityContext.tsx`)

```typescript
type ActivityModule =
  | "Project"
  | "Env Variables"
  | "License Keys"
  | "Admin Credentials"
  | "App Users"
  | "Team";

interface ActivityEntry {
  id: number;
  projectId: number | null;
  projectName: string;
  userName: string;
  module: ActivityModule;
  message: string;
  actorRole: Role | null;
  createdAt: number;        // Unix timestamp
  read: boolean;
}
```

---

## 11. Website User Flow

### Full User Journey Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UNAUTHENTICATED                             │
└─────────────────────────────────────────────────────────────────────┘

  Browser → /
      │
      └──▶ Redirect to /login
                │
                ▼
         ┌──────────────┐
         │  Login Page  │
         │ (split view) │
         └──────┬───────┘
                │ Enter email + password
                ▼
         Credentials valid?
          │           │
         Yes          No ──▶ Show error message (stay on /login)
          │
          ▼
    Session created
    (sessionStorage)
          │
          └──▶ /dashboard (Admin) or /dashboard/projects (Developer)


┌─────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATED — ADMIN FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

  /dashboard  ──────────────────────────────── Admin Dashboard
      │         Stats: projects, members,        (AdminDashboard)
      │         credentials, active count
      │         Projects table, activity feed
      │
  /dashboard/projects ──────────────────────── Projects Card Grid
      │         Search + status filter           (Dashboard)
      │         "Add Project" button visible
      │         Each card → click → project detail
      │
  /dashboard/projects/[id] ─────────────────── Project Detail
      │         8 tabs available:
      │           • Overview
      │           • Credentials Overview    ← Dev/Deployment system creds
      │           • Environment Variables  ← Add/view/delete
      │           • License Keys           ← Add/view/delete
      │           • Admin Credentials      ← Add/view/delete
      │           • App Users              ← Add/view/delete
      │           • Team                   ← Assign/remove members
      │           • Activity Log           ← Project history
      │
  /dashboard/teams ─────────────────────────── Teams Management
      │         Left: teams list              (TeamsPage)
      │         Right: team detail + members
      │         Create/edit/delete teams
      │
  /dashboard/notifications ─────────────────── Full Notifications
      │         Filter: All / Unread / Read   (AllNotificationsPage)
      │         Mark all read
      │
  /dashboard/settings ──────────────────────── Settings
                Update profile, change password (SettingsPage)


┌─────────────────────────────────────────────────────────────────────┐
│                  AUTHENTICATED — DEVELOPER FLOW                     │
└─────────────────────────────────────────────────────────────────────┘

  /dashboard  ──────────────────────────────── "Access Restricted" message
      │
  /dashboard/projects ──────────────────────── Projects Card Grid
      │         Only shows: own projects + assigned projects
      │         "Add Project" button NOT visible
      │
  /dashboard/projects/[id] ─────────────────── Project Detail
      │         Can view all 8 tabs (read-only for credentials)
      │         Cannot add/remove credentials or team members
      │         Activity log shows own-scope entries
      │
  /dashboard/teams ─────────────────────────── NOT accessible
      │         Redirect / access denied
      │
  /dashboard/notifications ─────────────────── Notifications
      │         Only sees notifications for own actions + responses
      │
  /dashboard/settings ──────────────────────── Settings
                Update own profile and password
```

### Credential Management Sub-Flow (Admin)

```
Project Detail → Select tab (e.g., "Environment Variables")
    │
    ▼
View existing records (name, value, masked by default)
    │
    ├─ Click "Add" → AddEnvVariableForm modal opens
    │     │
    │     ▼
    │   Fill form → Submit
    │     │
    │     ▼
    │   Record saved to project state
    │   Activity logged → Toast fires → Notifications updated
    │
    ├─ Click eye icon → Toggle value visibility
    │
    └─ Click delete → Confirm → Record removed → Activity logged
```

### Team Assignment Sub-Flow (Admin)

```
Project Detail → "Team" tab
    │
    ▼
View current team members
    │
    ├─ Click "Assign Member" → Select from available accounts
    │     │
    │     ▼
    │   Member added → membersByProject updated in context
    │   Activity logged
    │
    └─ Click "Remove" on member → Confirmed removal
         │
         ▼
       membersByProject updated → Activity logged
```

### Notification Flow

```
Any user performs an action (add credential, create project, etc.)
    │
    ▼
ActivityContext.log() called
    │
    ├─ New ActivityEntry created with actorRole
    ├─ Saved to sessionStorage
    ├─ Toast added to toasts[] (auto-dismiss 4.5s)
    └─ unreadCount incremented
    │
    ▼
Bell icon badge updates
    │
    ▼
Other users (who can receive this notification) see it in:
    ├─ NotificationPanel (bell dropdown)
    └─ /dashboard/notifications (full feed)

Notification visibility rule:
    Developer action → Admin + Developer see it
    Admin action     → Admin only sees it
```

---

## 12. Cross-Tab Sync

The application keeps multiple open browser tabs in sync using the native `storage` event.

### How It Works

1. When any context writes to `localStorage`, it serializes the new state
2. The browser fires a `storage` event in **all other tabs** with the same origin
3. Each context in other tabs listens for this event on the specific storage key
4. On receiving the event, the context deserializes the new value and updates React state
5. To prevent write/event ping-pong, contexts compare the serialized value before writing — if unchanged, no write occurs

### Synced Data

| Context | Synced Via | Key |
|---------|-----------|-----|
| AuthContext (accounts) | localStorage event | `pcmp_users` |
| ProjectsContext (projects) | localStorage event | `pcmp_projects` |
| ProjectsContext (members) | localStorage event | `pcmp_members` |

### Not Synced

- `pcmp_session` (sessionStorage) — tab-local by design
- `pcmp_activities` (sessionStorage) — tab-local by design

---

## 13. Recent Changes (2026-06-24)

### New Page — System (`/dashboard/systems`)
`SystemCredentialsPage` provides a table of system-wide device credentials. Admins can Add / Edit / Delete devices; Developers can view and reveal passwords. The page uses a per-field reveal model so toggling one password column never affects the others. The copy button is only rendered when a field is revealed, ensuring `navigator.clipboard.writeText()` always receives real plaintext. See [Section 9 — System Components](#system-components) for full detail.

### Copy Button Fix (Production / HTTPS)
All credential copy buttons now wrap `navigator.clipboard.writeText()` in a `try/catch`. The Clipboard API is only available in secure contexts (HTTPS); the previous code failed silently in production with no visual feedback. The fix applies to `SystemCredentialsPage`, `AdminCredentialsPage`, and `AppUsersPage`.

### App User — Email Now Optional
`AddAppUserForm` no longer validates email as a required field. The label reads `(optional)`, a soft inline warning appears for malformed input, but submission is not blocked. Mirrors the backend serializer change (`required=False, allow_blank=True`).

### Env Variable — Delete File Button
`AddEnvVariableForm` now shows an **X** button next to an attached file when in edit mode. Clicking removes the attachment from local state; saving propagates the removal to the backend via `PATCH` with empty `file_name`/`file_data` fields.

### ENV Key — Dot-Prefixed Names Accepted
The "Name" field in `AddEnvVariableForm` now accepts any non-empty string (placeholder updated to `.env or .env.local`). The backend `validate_key()` method was updated to match, so names like `.env`, `.env.local`, and `env.production` are stored verbatim.

---

*Documentation generated for Project Credentials Management Portal — Frontend v1.0*
*Last updated: 2026-06-24*
