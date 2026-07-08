# MoH Performance Management System — User Guide

This guide explains how to use the web application for day-to-day performance management, leave, attendance, and administration at the Ministry of Health Uganda.

## Contents

1. [Getting started](#1-getting-started)
2. [Navigation and roles](#2-navigation-and-roles)
3. [Dashboard](#3-dashboard)
4. [Performance management](#4-performance-management)
5. [Leave](#5-leave)
6. [Out of station](#6-out-of-station)
7. [Attendance](#7-attendance)
8. [Notifications](#8-notifications)
9. [Profile and settings](#9-profile-and-settings)
10. [Administration (HR and system admins)](#10-administration-hr-and-system-admins)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Getting started

### Sign in

1. Open the application URL provided by your IT team (demo: **http://localhost:5173**).
2. Enter your **email** and **password**.
3. Click **Sign in**.

Your session stays active until you sign out or the token expires. If you forget your password, contact your HR or system administrator.

### Demo environment

For training and demos, these accounts are available after database seeding:

| Email | Role |
|-------|------|
| `worker@moh.go.ug` | Health worker (staff) |
| `supervisor@moh.go.ug` | Supervisor |
| `depthead@moh.go.ug` | Department head |
| `hr@moh.go.ug` | HR officer |
| `director@moh.go.ug` | Director |
| `ps@moh.go.ug` | Permanent secretary |
| `admin@moh.go.ug` | System administrator |

Default demo password: **`Demo@Moh2026!`**

---

## 2. Navigation and roles

The sidebar shows only the sections your account is allowed to access. Menu groups include:

| Group | Items | Who typically sees it |
|-------|-------|------------------------|
| **Dashboard** | Overview | All roles with dashboard permission |
| **Performance** | PPA and quarterly reporting | Staff with `performance.view` |
| **Time & Attendance** | Leave, Out of station, Attendance | Staff and supervisors |
| **Notifications** | Alerts and updates | Everyone |
| **My Account** | Profile, Settings | Everyone |
| **Administration** | Leave, Staff, KPI, Access control | HR officers and admins |

### What each role does

| Role | Primary responsibilities in PMS |
|------|--------------------------------|
| **Staff** | Build PPA, file quarterly reports, request leave/OOS, clock attendance |
| **Supervisor** | Approve leave/OOS, review team performance, supervision dashboard |
| **Department head** | Department-level oversight and dashboard |
| **HR officer** | Leave administration, staff records, org-wide reporting |
| **Director / Executive** | District or national dashboards and summaries |
| **Administrator** | KPI catalog, user access, system configuration |

---

## 3. Dashboard

After sign-in you land on **Dashboard**. The view adapts to your role:

- **Health worker** — personal KPIs, leave balance snapshot, attendance summary, quick links
- **Supervisor** — team leave/performance pending items, supervision metrics
- **Department head** — department coverage and performance indicators
- **HR / Director / Executive** — facility and district charts, org-wide KPI and attendance trends

Use dashboard cards and charts to drill into areas that need action (e.g. pending approvals).

---

## 4. Performance management

Go to **Performance** in the sidebar.

Performance follows the annual cycle:

1. **Review assigned KPIs** — indicators from your job (mandatory), department pool, and any individual HR assignments.
2. **Build your Performance Plan (PPA)** — set weight % (total must equal 100%) and annual targets, then submit for supervisor review.
3. **File quarterly reports** — enter actuals and narrative evidence for each reporting window.

### Planning tab

- KPIs are grouped by **subject area** (e.g. Clinical, Management).
- For each indicator set:
  - **Weight %** — share of your total 100%
  - **Target** — annual target value (often a percentage for ratio KPIs)
- Mandatory job KPIs are marked as required.
- **Cumulative** indicators show a **Cumulative · YTD** badge — these are tracked year-to-date through the year (see Reporting below).
- Submit your plan when weights total **100%** and the PPA window is open.

### Reporting tab

Reporting periods align with the financial year:

| Period | Typical coverage |
|--------|------------------|
| Q1 | Jul – Sep |
| Midterm | Oct – Dec |
| Q3 | Jan – Mar |
| End of year | Apr – Jun |

For each period:

1. Select an **open** reporting window (closed periods cannot be edited).
2. Enter **actual achieved** for each KPI in your approved plan.
3. Add **narrative / evidence** where required.
4. Review the **progress bar** (actual vs target).
5. Submit the report.

#### Cumulative indicators

Some KPIs are configured as **cumulative**. For these:

- Enter your **year-to-date (YTD) total**, not just this quarter’s increment.
- Progress is measured against your **annual target** as performance builds through the year.
- Earlier submitted periods are shown as a timeline (e.g. Q1: 30% → Midterm: 55%).
- YTD values should not decrease compared to a prior period; the system warns if they do.

HR and KPI administrators mark indicators as cumulative under **Administration → KPI Management**.

### Overview tab

Shows PPA status, total weight, current workflow stage, and reporting window status for the financial year.

---

## 5. Leave

Go to **Leave** under **Time & Attendance**.

### Apply for leave

1. Click **New request** (or equivalent).
2. Choose **leave type** (annual, sick, maternity, etc.).
3. Select **start and end dates**.
4. Add remarks and attachments if required (e.g. medical report for extended sick leave).
5. Submit — the request routes to your supervisor(s) per the configured approval chain.

### Track requests

- View status: draft, pending, approved, rejected, completed.
- See which **approval stage** the request is at.
- Cancel or amend only while policy allows (before final HR processing).

### Balances

Your entitlement and **used / remaining** days appear on the leave page. Balances depend on salary grade and leave type configured by HR.

### Supervisors

Supervisors see team requests on their dashboard and can **approve** or **reject** with comments at their stage in the workflow.

---

## 6. Out of station

Go to **Out of station** when you need approval to work away from your duty station.

1. Create a request with **dates**, **reason**, and **remarks**.
2. Set the **destination** on the map (latitude/longitude).
3. Attach supporting documents if needed.
4. Submit for supervisor approval.

After approval, attendance clocking at that location can be verified against the approved destination (geofence).

---

## 7. Attendance

Go to **Attendance** to **clock in** or **clock out**.

- Location may be captured for verification.
- If you have an approved out-of-station request for the day, your position is checked against the approved destination.
- View your clock history and verification status (`verified_oos`, `at_duty_station`, `outside_geofence`).

Work hours and clock windows follow MoH policy configured in the system.

---

## 8. Notifications

Go to **Notifications** for in-app alerts:

- Leave and OOS approval updates
- Performance plan or report reminders
- System announcements

The bell icon in the header shows unread count. Open a notification to see details and any linked action.

---

## 9. Profile and settings

### Profile

- Update contact details where permitted
- Upload **photo** and **signature** for official documents

### Settings

- Language and display preferences (where enabled)
- Notification preferences

Administrators may configure additional system settings via admin APIs; most staff only change personal preferences here.

---

## 10. Administration (HR and system admins)

Visible under **Administration** when you have the right permissions.

### Leave management (`/admin/leave`)

HR officers manage the full leave lifecycle:

| Tab | Purpose |
|-----|---------|
| **Overview** | Org-wide leave statistics |
| **Balances** | Staff leave balances; initialize year |
| **Requests** | All requests; HR finalization |
| **Statements** | Individual staff leave statements |
| **Configuration** | Types, entitlements, approval stages, global settings |

Leave rules (advance notice, carry-over, work hours) are stored in the database — not hardcoded — so HR can adjust policy without code changes.

### Staff management (`/admin/staff`)

- Browse and search the staff directory
- Enrich HR profile fields
- Assign up to **three supervisors** per staff member (Supervisor 1 is required)
- Supervision is managed in the same **Manage** modal as HR details

### KPI management (`/admin/kpi`)

| Tab | Purpose |
|-----|---------|
| **Catalog** | Create, edit, and deactivate KPIs |
| **Assignments** | Assign KPIs to jobs, departments, or individual staff |

When creating or editing a KPI:

- Set **frequency**, **computation** (ratio vs value), and **default target**
- Enable **Cumulative indicator** when staff should report YTD totals each period rather than period-only values
- Cumulative KPIs display a badge in the catalog and in staff performance screens

### Access control (`/admin/rbac`)

System administrators:

- Manage **roles** and **permissions**
- Create users and assign roles
- Set **district / facility scope** for HR and regional officers

---

## 11. Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Cannot sign in** | Check email/password; account may be locked after failed attempts — wait or contact admin |
| **Menu item missing** | Your role may not have that permission — ask administrator |
| **Cannot submit PPA** | Ensure weights total 100%; check PPA window is open |
| **Cannot file report** | Submit and get PPA approved first; confirm reporting window is open |
| **Leave request rejected** | Read supervisor/HR comments; check balance and advance-notice rules |
| **Clock verification failed** | Ensure OOS is approved for today and you are within the geofence |
| **Dashboard error** | Refresh the page; sign out and back in; report persistent errors to IT |

For technical support, contact your facility or national PMS support desk with your email, role, and a screenshot of any error message.

---

## Related documents

- [README](../README.md) — setup and architecture for developers
- [leave.md](../leave.md) — detailed leave policy reference
