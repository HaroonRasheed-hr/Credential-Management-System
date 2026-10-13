# Project Credentials Management Portal

## Software Requirements & Design Document

**Organization:** Xis.ai - Internal Tooling Initiative
**Prepared For:** Xis.ai Engineering Team
**Version:** 1.0
**Date:** June 2026

---

# Table of Contents

1. Problem Statement
2. Goals & Scope

   * 2.1 Goals
   * 2.2 Scope
3. User Roles & Permissions
4. Data Model & Entity Relationship Overview
5. Module Breakdown

   * 5.1 Project Module
   * 5.2 Team / Membership Module
   * 5.3 Environment Variables Module
   * 5.4 License Keys Module
   * 5.5 Admin Credentials Module
   * 5.6 Django App Users Module
   * 5.7 Activity Log Module
6. Security & Encryption Strategy
7. High-Level API Endpoints
8. UI Wireframe Description

   * 8.1 Project List Page
   * 8.2 Project Detail Page
9. Future Enhancements

---

# 1. Problem Statement

Xis.ai manages multiple client and internal projects. Each project contains sensitive information such as:

* Environment configuration files (`.env`)
* Third-party license keys
* Administrative credentials
* Django application user accounts

Currently, this information is stored across personal notes, shared drives, spreadsheets, and chat messages, making management difficult and increasing security risks.

The organization requires a centralized, secure, and access-controlled platform where project-related credentials and configurations can be managed efficiently.

---

# 2. Goals & Scope

## 2.1 Goals

* Provide a centralized portal for managing project credentials and configurations.
* Organize sensitive information into dedicated modules.
* Allow project administrators to manage team access.
* Implement role-based access control (RBAC).
* Maintain a complete audit trail of system activity.
* Securely store and manage secrets.

## 2.2 Scope

### In Scope

* Project Management
* Team Membership Management
* Environment Variables Management
* License Keys Management
* Admin Credentials Management
* Django App Users Management
* Activity Logging
* Role-Based Access Control
* Secure Secret Storage

### Out of Scope (Initial Release)

* Automated deployment integrations
* Automatic license renewal management
* Email or Slack notifications
* Secrets Manager integrations
* Two-factor authentication

---

# 3. User Roles & Permissions

Permissions are evaluated per project through project membership.

| Action               | Admin | Developer |
| -------------------- | ----- | --------- |
| Create New Project   | Yes   | No        |
| Add Team Members     | Yes   | No        |
| Add Self to Project  | No    | No        |
| View Project Records | Yes   | Yes       |
| Create Records       | Yes   | Yes       |
| Update Records       | Yes   | Yes       |
| Delete Records       | Yes   | No        |
| Remove Team Members  | Yes   | No        |
| View Activity Logs   | Yes   | Yes       |

### Business Rules

* Users cannot add themselves to a project.
* Backend validation must reject self-add requests.
* Every project must always contain at least one admin.

---

# 4. Data Model & Entity Relationship Overview

## Core Entities

### Project

* id
* name
* slug
* description
* status
* created_by
* created_at

### ProjectMember

* id
* project
* user
* role
* added_by
* added_at

### EnvironmentVariable

* id
* project
* key
* value (encrypted)
* environment
* updated_by
* updated_at

### LicenseKey

* id
* project
* license_name
* license_key (encrypted)
* vendor
* expiry_date
* updated_by
* updated_at

### AdminCredential

* id
* project
* admin_panel_url
* username
* password (encrypted)
* notes
* updated_by
* updated_at

### DjangoAppUser

* id
* project
* username
* email
* password_or_token (encrypted)
* role_in_app
* updated_by
* updated_at

### ActivityLog

* id
* project
* user
* action
* module_name
* object_id
* timestamp

### Relationships

```text
Project
 ├── Project Members
 ├── Environment Variables
 ├── License Keys
 ├── Admin Credentials
 ├── Django App Users
 └── Activity Logs
```

---

# 5. Module Breakdown

## 5.1 Project Module

Represents a client or internal project.

### Fields

* name
* slug
* description
* status (active/archived)
* created_by
* created_at

### Rules

* Project creator automatically becomes the first admin.
* Only admins can manage project settings.

---

## 5.2 Team / Membership Module

Manages project membership and roles.

### Fields

* project
* user
* role (admin/developer)
* added_by
* added_at

### Rules

* Only project admins can add or remove members.
* Users cannot add themselves.
* A project must always have at least one admin.

---

## 5.3 Environment Variables Module

Stores project configuration values.

### Fields

* project
* key
* value (encrypted)
* environment
* updated_by
* updated_at

### Features

* Support Development, Staging, and Production environments.
* Values are encrypted at rest.
* Values are masked by default in the UI.
* Explicit reveal actions are logged.

---

## 5.4 License Keys Module

Stores third-party software license information.

### Fields

* project
* license_name
* license_key (encrypted)
* vendor
* expiry_date
* updated_by
* updated_at

### Features

* Secure storage of license keys.
* Expiry tracking for future reminder functionality.

---

## 5.5 Admin Credentials Module

Stores administrative access credentials.

### Fields

* project
* admin_panel_url
* username
* password (encrypted)
* notes
* updated_by
* updated_at

### Examples

* Django Admin
* Hosting Panels
* Cloud Dashboards
* Third-Party Admin Portals

---

## 5.6 Django App Users Module

Stores application-level user accounts created inside project applications.

### Fields

* project
* username
* email
* password_or_token (encrypted)
* role_in_app
* updated_by
* updated_at

### Note

These records are separate from Xis.ai staff accounts used to access the portal.

---

## 5.7 Activity Log Module

Provides a complete audit trail.

### Fields

* project
* user
* action
* module_name
* object_id
* timestamp

### Logged Events

* Create
* Update
* Delete
* Secret Reveal
* Team Membership Changes

---

# 6. Security & Encryption Strategy

## Encryption

Sensitive fields are encrypted at rest:

* Environment Variable Values
* License Keys
* Admin Passwords
* App User Passwords/Tokens

Recommended approaches:

* django-cryptography
* AES encryption
* Dedicated secret management service

## Key Management

* Encryption keys must never be committed to source control.
* Keys should be stored in:

  * Environment Variables
  * Secrets Managers
  * Secure Vaults

## Additional Security Measures

* HTTPS enforced across all environments.
* Server-side permission validation.
* Secret masking by default.
* Audit logging for reveal actions.
* Rate limiting for sensitive endpoints.

---

# 7. High-Level API Endpoints

| Endpoint                                | Methods                  | Access                 |
| --------------------------------------- | ------------------------ | ---------------------- |
| `/api/projects/`                        | GET, POST                | Authenticated          |
| `/api/projects/{id}/`                   | GET, PATCH, DELETE       | Members / Admin        |
| `/api/projects/{id}/members/`           | GET, POST, DELETE        | Admin                  |
| `/api/projects/{id}/env-variables/`     | GET, POST, PATCH, DELETE | Members / Admin Delete |
| `/api/projects/{id}/license-keys/`      | GET, POST, PATCH, DELETE | Members / Admin Delete |
| `/api/projects/{id}/admin-credentials/` | GET, POST, PATCH, DELETE | Members / Admin Delete |
| `/api/projects/{id}/app-users/`         | GET, POST, PATCH, DELETE | Members / Admin Delete |
| `/api/projects/{id}/activity-log/`      | GET                      | Members                |

### API Rules

* Authentication required for all endpoints.
* Delete operations are restricted to project admins.
* Self-add requests must be rejected.

---

# 8. UI Wireframe Description

## 8.1 Project List Page

### Features

* List all projects accessible to the user.
* Table view or card view.
* Search and filtering.
* Create Project button.

### Display Information

* Project Name
* Status
* Description
* Member Count
* Created Date

---

## 8.2 Project Detail Page

### Tab Navigation

#### 1. Overview

* Project information
* Status
* Created date

#### 2. Environment Variables

* Key
* Value (masked)
* Environment

#### 3. License Keys

* License Name
* Vendor
* Expiry Date
* Key (masked)

#### 4. Admin Credentials

* Admin URL
* Username
* Password (masked)
* Notes

#### 5. Django App Users

* Username
* Email
* Role
* Credential (masked)

#### 6. Team

* Member List
* Roles
* Add Member
* Remove Member

#### 7. Activity Log

* Chronological activity feed
* Filter by user
* Filter by module

### UI Permissions

* Delete actions visible only to admins.
* Backend validation remains the final authority.
