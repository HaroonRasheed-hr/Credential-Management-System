# Credential Management System — User Guide

This guide explains how the website works from a normal user's point of view. It
walks through the first page that a user sees, how a user signs in, and what each
type of user is allowed to do after signing in. The two types of users are the
**Admin** and the **Developer**, and each one has a different level of access.

This document does not cover code or installation. For those topics, see
[application-flow.md](application-flow.md), [backend-documentation.md](backend-documentation.md),
and [PRD.md](PRD.md).

---

## 1. What This Portal Is For

Credential Management System helps teams organize many projects, each holding
sensitive information such as environment files, license keys, admin passwords,
and application user accounts. In the past this information was spread across notes,
spreadsheets, drives, and chat messages, which was hard to manage and was not
safe.

This portal brings all of that information into one place. Access is controlled by
role, secrets are stored in an encrypted form, secrets are hidden by default, and
every important action is recorded in an activity log.

---

## 2. The First Page (Login Page)

When a user opens the website, the very first thing they see is the **Login page**.
The home address of the site does not show any public content. It sends the user
straight to the login screen, because this is an internal tool and only staff
accounts are allowed inside.

The login page is split into two halves.

### Left side

- The **Credential Management System logo**.
- The tagline, **"Precision Beyond Perception"**.
- A background illustration. On small screens, such as a mobile phone, this
  illustration is hidden so that the form is easier to use.

### Right side

- A card with the heading **"Login"**.
- An **Email** field.
- A **Password** field.
- A button to sign in.

A user cannot create their own account from this page. Accounts are created and
managed inside the portal by an Admin, so a new staff member must be added by an
Admin before they can log in.

---

## 3. Signing In

To sign in, the user enters their **email** and **password**, and then submits the
form.

1. The user types the email address of their account.
2. The user types the password of their account.
3. The user presses the login button.

If the email and password are correct, the user is signed in and is taken to their
home screen. The screen that a user lands on depends on the role of the account.

- An **Admin** lands on the main **Dashboard**.
- A **Developer** lands on the **Projects** page.

### When the details are wrong

- If the password is wrong, the page shows an error and tells the user how many
  attempts are left.
- After three failed attempts in a row, the account is locked for a short time, and
  the user must wait before trying again. This protects the account from someone
  guessing the password.
- If the system cannot be reached at all, the page shows a network error so the
  user knows the problem is the connection and not the password.

### Staying signed in

Once a user is signed in, the session is remembered, so the user does not need to
log in again on every page. If the session is no longer valid, the user is sent
back to the login page automatically.

---

## 4. The Two Roles at a Glance

The portal has two roles. The Admin has full control, and the Developer has a
limited, focused level of access.

| Area                                   | Admin                | Developer                        |
| -------------------------------------- | -------------------- | -------------------------------- |
| Dashboard page                         | Yes                  | No                               |
| Projects page                          | Yes, all projects    | Yes, only their projects         |
| Create a new project                   | Yes                  | No                               |
| Edit, archive, or activate a project   | Yes                  | No                               |
| Delete records inside a project        | Yes                  | No                               |
| Add records inside a project           | Yes                  | Yes                              |
| Update records inside a project        | Yes                  | Yes                              |
| Teams page                             | Yes                  | Yes, view only                   |
| Create a team                          | Yes                  | No                               |
| Add or remove team members             | Yes                  | No                               |
| Add a member to a project              | Yes                  | No                               |
| Settings page                          | Yes                  | No                               |
| View activity logs                     | Yes                  | Yes                              |

The menu at the top of the screen also changes with the role. A Developer does not
see the **Dashboard** link or the **Settings** link, because those areas are for
Admins only. The user only sees what they are allowed to use.

> **Important:** The buttons and links in the screen are only the first layer. The
> real check happens on the server. Even if a person tries to skip the screen, the
> server still blocks any action that the role is not allowed to perform.

---

## 5. What an Admin Can Do

An Admin has the highest level of access. After signing in, the Admin lands on the
**Dashboard**, and the top menu shows **Dashboard**, **Projects**, **Teams**, and
**Settings**.

### 5.1 Dashboard

The Dashboard is the Admin home screen. It gives an overview of the system and a
view of recent activity. From here the Admin can also export an activity report as
a PDF for a chosen date range.

### 5.2 Projects

The Admin can see **every project** in the system, not only their own. On the
Projects page the Admin can do the following.

- **Create a new project.** The "Add Project" button is shown to Admins only. The
  person who creates a project is treated as the admin of that project.
- **Open any project** to manage everything inside it.
- **Edit a project**, for example to change its name or description.
- **Archive a project** to make it read only, and **activate** it again later. When
  a project is archived, the records inside it can still be viewed, but they cannot
  be changed until the project is activated again.

Deleting a project, and deleting records inside a project, is limited to Admins.

### 5.3 Inside a Project

Every project opens with a row of tabs. The tabs are:

1. **Overview** — the project name, description, status, created date, who created
   it, and the number of team members. The Admin can edit the project or change its
   status from here.
2. **Credentials Overview** — system credentials for the project, described in
   section 5.5 below.
3. **Environment Variables** — configuration values such as the contents of an
   `.env` file.
4. **License Keys** — third party license information, with the key, the vendor, and
   the expiry date.
5. **Admin Credentials** — admin panel access, such as a hosting panel or a cloud
   dashboard, with the URL, the username, and the password.
6. **App Users** — user accounts that live inside the project's own application, with
   the username, the email, and the role inside that application. These are not the
   staff accounts used to sign in to this portal.
7. **Team** — the members of the project, described in section 5.6 below.
8. **Activity Log** — a record of who did what inside the project, and when.

The Admin can **add, update, and delete** records in every one of these tabs. The
ability to delete a record is the main difference from a Developer.

### 5.4 Teams

The Teams page lists the teams in the organisation. Only an Admin can manage teams.
An Admin can:

- **Create a team**, with a name, a description, and a team type.
- **Edit a team**.
- **Delete a team**.

### 5.5 System Credentials

Inside a project, the **Credentials Overview** tab holds the system credentials.
These are split into two sections, **Development** and **Deployment**, so the
details for the development machine and the production machine are kept apart.

Each section stores the following fields.

- **System Name**, which is shown in plain text because it is not a secret.
- **System IP**.
- **Admin Password**.
- **RustDesk IP**.
- **RustDesk Password**.

The secret fields are hidden by default and are shown as dots. The user can reveal
a field with the eye icon, and can copy a value with the copy icon. The **Edit**
button lets the user change the values and then save them.

### 5.6 Team Members on a Project

A project has its own list of members on the **Team** tab. This decides who can
work inside that project.

- Only an Admin can **add a member** to a project.
- Only an Admin can **remove a member** from a project.
- A member's role on the project, Admin or Developer, follows the role they already
  have, so there is no separate picker for it.

There are two firm rules for membership.

- A user **cannot add themselves** to a project. The request is rejected on the
  server.
- A project must always keep **at least one admin**, so the last admin cannot be
  removed.

### 5.7 Settings

The Settings page is available to Admins only. From here the Admin can:

- View their profile and a few simple statistics, such as the number of projects.
- Edit their profile, which is the first name, the last name, the username, and the
  email.
- Change their password. After the password is changed, the user is asked to sign
  in again.

---

## 6. What a Developer Can Do

A Developer has a focused level of access. The Developer can do the day to day work
inside a project, but cannot manage the structure of the system. After signing in,
the Developer lands on the **Projects** page, and the top menu shows only
**Projects** and **Teams**. The Dashboard and the Settings links are not shown to a
Developer.

### 6.1 Projects

A Developer sees only the projects that they created or that they were added to as a
member. They do not see every project in the system. A Developer does **not** see
the "Add Project" button, because creating a project is an Admin only action.

### 6.2 Inside a Project

A Developer opens a project and sees the same set of tabs as the Admin. Inside each
tab a Developer can **view records** and can **add and update records**. For
example, a Developer can:

- Add or update an **environment variable**, such as a value for an `.env` file.
- Add or update a **license key**, with its vendor and expiry date.
- Add or update an **admin credential**.
- Add or update an **app user**.

A Developer **cannot delete** records. Delete is an Admin only action. A Developer
also cannot add or remove project members, and cannot edit, archive, or delete the
project itself.

When a project is archived, it becomes read only for everyone, so a Developer cannot
change records in an archived project until an Admin activates it again.

### 6.3 Teams

A Developer can open the **Teams** page and view the teams, but the "Add Team"
button and the edit and delete actions are not available to them, because those are
Admin only.

### 6.4 Activity and Notifications

A Developer can view the activity log inside a project. When a Developer performs an
action, the system records it, and the relevant Admins are notified. This keeps the
Admins aware of changes without the Developer needing to tell them by hand.

---

## 7. How Secrets Are Protected

Across the whole portal, the same safety rules apply to every secret.

- **Hidden by default.** Passwords, keys, and other secrets are shown as dots, not as
  plain text.
- **Reveal on request.** A user can click the eye icon to reveal a single value when
  they need it.
- **Recorded.** When a secret is revealed, that action is written to the activity
  log, so there is always a record of who saw a secret.
- **Encrypted at rest.** Secrets are stored in an encrypted form, not as plain text.
- **Checked on the server.** Every action is checked on the server against the user's
  role, so the screen alone can never grant access that the role does not have.

---

## 8. Quick Summary

- The first page is the **login page**, where a user signs in with an **email** and a
  **password**. There is no public content and no self sign up.
- An **Admin** can do everything. An Admin creates projects, edits, archives, and
  deletes them, manages teams, adds and removes project members, manages system
  credentials, and uses the Dashboard, the Settings page, and reports.
- A **Developer** has a focused role. A Developer works inside the projects they
  belong to, adds and updates records such as environment variables and license
  keys, and views teams and activity, but cannot create projects, cannot delete
  records, and cannot manage teams or members.
- Secrets are hidden by default, are revealed only on request, and every reveal is
  recorded.

---

*User guide for the Credential Management System.*
