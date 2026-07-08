# MoH Performance Management System — User Guide

This guide explains how to use the web application for day-to-day performance management, leave, attendance, and administration at the Ministry of Health Uganda.

## Contents

1. [Getting started](#1-getting-started)
2. [System architecture and data flow](#2-system-architecture-and-data-flow)
3. [Navigation and roles](#3-navigation-and-roles)
4. [Dashboard](#4-dashboard)
5. [Performance management](#5-performance-management)
6. [Leave](#6-leave)
7. [Out of station](#7-out-of-station)
8. [Attendance](#8-attendance)
9. [Notifications](#9-notifications)
10. [Profile and settings](#10-profile-and-settings)
11. [Administration (HR and system admins)](#11-administration-hr-and-system-admins)
12. [Troubleshooting](#12-troubleshooting)
13. [Accessing a deployed server](#13-accessing-a-deployed-server)

---

## 1. Getting started

### Sign in

1. Open the application URL provided by your IT team:
   - **Deployed server:** `http://<server-ip>/` (or your organisation domain)
   - **Local development:** `http://localhost:5173`
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

## 2. System architecture and data flow

This section gives a simple picture of how the system is built and how your actions move through it. You do not need technical knowledge to use PMS — this is here to help staff, supervisors, and HR understand **where information comes from** and **who sees what**.

### 2.1 Big picture — layers

When you use PMS in a browser, your request passes through a few layers before data is saved or returned:

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  You        │     │  Web app    │     │  API        │     │  Database   │
│  (browser)  │ ──► │  (screens)  │ ──► │  (server)   │ ──► │  (records)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │                    │
  Click, type          Dashboard,           Rules, roles,        Staff, leave,
  sign in              Leave,               approvals,           KPIs, reports
                       Performance          permissions          attendance
```

| Layer | What it does | What you see |
|-------|----------------|--------------|
| **Browser** | Your phone or computer | Login page, menus, forms, charts |
| **Web app** | Screens and navigation | Dashboard, Performance, Leave, etc. |
| **API (server)** | Business rules and security | Nothing directly — works behind the scenes |
| **Database** | Permanent storage | Your saved requests, balances, reports |

On a deployed server, a **gateway (nginx)** sits in front and sends `/` to the web app and `/api/` to the server — so you use one address (e.g. `http://203.0.113.50/`) for everything.

```mermaid
flowchart LR
  subgraph users [Users]
    Staff[Staff]
    Supervisor[Supervisor]
    HR[HR / Admin]
  end

  subgraph presentation [What you interact with]
    Browser[Web browser]
    UI[MoH PMS screens]
  end

  subgraph platform [Platform — behind the scenes]
    API[API server]
    DB[(Database)]
    Cache[(Session cache)]
  end

  subgraph sources [Data sources]
    IHRIS[iHRIS staff records]
    HRConfig[HR policy config]
  end

  Staff --> Browser
  Supervisor --> Browser
  HR --> Browser
  Browser --> UI
  UI -->|requests| API
  API --> DB
  API --> Cache
  IHRIS -->|staff sync| DB
  HRConfig -->|leave types, KPIs| DB
  API -->|responses| UI
  UI --> Browser
```

### 2.2 Where master data comes from

| Data | Source | Who maintains it |
|------|--------|------------------|
| Staff names, jobs, facilities | **iHRIS** (synced into PMS) | National HR / iHRIS |
| User login and roles | **PMS accounts** | System administrators |
| Supervisors (up to 3 per staff) | **Staff management** | HR officers |
| KPI catalog and assignments | **KPI management** | HR / performance admins |
| Leave types, entitlements, stages | **Leave configuration** | HR officers |
| Your leave requests, PPAs, reports | **You and your approvers** | Created in PMS as you work |

PMS does **not** replace iHRIS for core HR master data — it **reads** staff deployment information and adds performance, leave workflow, and attendance on top.

### 2.3 Sign-in and access control

Every action is tied to your **account**, **role**, and **scope** (e.g. own records only, supervised staff, or whole district).

```mermaid
sequenceDiagram
  participant U as You
  participant UI as Web app
  participant API as API server
  participant DB as Database

  U->>UI: Enter email and password
  UI->>API: Login request
  API->>DB: Verify account and role
  DB-->>API: User, permissions, staff link
  API-->>UI: Secure session token
  UI-->>U: Dashboard (menus filtered by role)

  Note over U,DB: Later actions send the token with each request
  U->>UI: Open Leave / Performance
  UI->>API: Request data (with token)
  API->>API: Check permission and scope
  API->>DB: Read or write allowed records only
  DB-->>API: Result
  API-->>UI: Data for your screen
  UI-->>U: Show only what you may see
```

**Takeaway:** You only see menus and records your role allows. A health worker cannot open HR-wide leave administration; an HR officer can see org-wide balances but still follows permission rules.

### 2.4 Performance data flow (PPA and reporting)

```mermaid
flowchart TD
  A[HR defines KPIs in catalog] --> B[Assign to job / department / staff]
  B --> C[Staff sees assigned KPIs]
  C --> D[Staff builds PPA — weights and targets]
  D --> E[Supervisor reviews and approves plan]
  E --> F[Staff files quarterly reports]
  F --> G[Actuals and narrative saved per period]
  G --> H[Dashboards and summaries]
  G --> I{Cumulative KPI?}
  I -->|Yes| J[YTD total tracked across periods]
  I -->|No| K[Period actual vs target]
  J --> H
  K --> H
```

| Step | Data created | Stored as |
|------|----------------|-----------|
| HR sets KPIs | Indicator definitions | KPI catalog |
| Assignment | Who must report which KPI | KPI assignments |
| PPA planning | Weights % and annual targets | Performance plan (PPA) |
| Quarterly report | Actual value + evidence text | Report entries per period |
| Cumulative KPI | Running year-to-date total | Each period stores latest YTD |

### 2.5 Leave and approval data flow

```mermaid
flowchart LR
  subgraph employee [Employee]
    E1[Submit leave request]
  end

  subgraph workflow [Approval chain]
    S[Supervisor]
    RO[Responsible officer]
    HR[HR finalization]
  end

  subgraph records [Records updated]
    LR[Leave request]
    LB[Leave balance]
    N[Notification]
  end

  E1 --> LR
  LR --> S
  S -->|approve| RO
  S -->|reject| N
  RO -->|approve| HR
  HR --> LB
  HR --> N
```

| Stage | What happens to data |
|-------|----------------------|
| Submit | Request saved; days calculated; balance checked against policy |
| Supervisor / officer | Approval status and comments updated |
| HR finalize | Request marked complete; **used days** added to balance |
| Notifications | You and approvers get in-app alerts |

Leave rules (types, entitlements by salary grade, advance notice) come from **HR configuration** in the database — not hardcoded — so policy changes flow to new requests automatically.

### 2.6 Out of station and attendance

```mermaid
flowchart TD
  OOS[Staff submits OOS request with map location] --> Approve[Supervisor approves]
  Approve --> Approved[Approved destination stored]
  Clock[Staff clocks in/out with GPS] --> Check{Approved OOS today?}
  Check -->|Yes| Geo[Compare GPS to destination]
  Check -->|No| Station[Record at duty station]
  Geo --> Status[verified_oos / outside_geofence]
  Station --> Status
  Status --> History[Attendance history]
```

Attendance clock data links to **approved out-of-station** records so the system can verify you were at the declared location (within the configured distance).

### 2.7 End-to-end summary

```text
 iHRIS ──sync──► Staff directory ──► Your account linked to staff record
                                      │
 HR config ──► KPIs, leave policy ─────┤
                                      ▼
                              You use the web app
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              Performance          Leave          Attendance
              (PPA, reports)    (requests)      (clock, OOS)
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
                              Database (single source
                              of truth inside PMS)
                                      │
                                      ▼
                    Dashboards, notifications, HR admin views
```

**In short:** iHRIS and HR configuration **feed in** master data; you and your approvers **create** transactional data (plans, reports, leave, attendance); the API **enforces** rules and permissions; everyone with the right role **sees** aggregated views on dashboards and admin screens.

---

## 3. Navigation and roles

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

## 4. Dashboard

After sign-in you land on **Dashboard**. The view adapts to your role:

- **Health worker** — personal KPIs, leave balance snapshot, attendance summary, quick links
- **Supervisor** — team leave/performance pending items, supervision metrics
- **Department head** — department coverage and performance indicators
- **HR / Director / Executive** — facility and district charts, org-wide KPI and attendance trends

Use dashboard cards and charts to drill into areas that need action (e.g. pending approvals).

---

## 5. Performance management

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

## 6. Leave

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

## 7. Out of station

Go to **Out of station** when you need approval to work away from your duty station.

1. Create a request with **dates**, **reason**, and **remarks**.
2. Set the **destination** on the map (latitude/longitude).
3. Attach supporting documents if needed.
4. Submit for supervisor approval.

After approval, attendance clocking at that location can be verified against the approved destination (geofence).

---

## 8. Attendance

Go to **Attendance** to **clock in** or **clock out**.

- Location may be captured for verification.
- If you have an approved out-of-station request for the day, your position is checked against the approved destination.
- View your clock history and verification status (`verified_oos`, `at_duty_station`, `outside_geofence`).

Work hours and clock windows follow MoH policy configured in the system.

---

## 9. Notifications

Go to **Notifications** for in-app alerts:

- Leave and OOS approval updates
- Performance plan or report reminders
- System announcements

The bell icon in the header shows unread count. Open a notification to see details and any linked action.

---

## 10. Profile and settings

### Profile

- Update contact details where permitted
- Upload **photo** and **signature** for official documents

### Settings

- Language and display preferences (where enabled)
- Notification preferences

Administrators may configure additional system settings via admin APIs; most staff only change personal preferences here.

---

## 11. Administration (HR and system admins)

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

## 12. Troubleshooting

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

## 13. Accessing a deployed server

When IT deploys PMS on a server using the project **`setup.sh`** script, you typically access it by IP or hostname in the browser — no port number needed when using the default configuration.

| Environment | URL example |
|-------------|-------------|
| Production (default) | `http://203.0.113.50/` |
| Custom port | `http://203.0.113.50:8080/` |
| Organisation domain | `https://pms.moh.go.ug/` |

### Demo vs production

| | Demo deployment | Production deployment |
|--|-----------------|----------------------|
| Sample users | Yes (`worker@moh.go.ug`, etc.) | Created by administrators |
| Password | `Demo@Moh2026!` (unless changed) | Assigned per user |
| Sample KPIs / leave data | Pre-loaded | Configured by HR |

If you cannot reach the URL, confirm with IT that:

- The server firewall allows HTTP on the configured port
- Your network can route to the server IP
- You are using `http://` (not `https://`) unless TLS has been configured

Server administrators: see **[DEPLOYMENT.md](DEPLOYMENT.md)** for full install and operations instructions.

---

## Related documents

- [README](../README.md) — setup and architecture for developers
- [DEPLOYMENT.md](DEPLOYMENT.md) — server deployment with Docker and nginx
- [leave.md](../leave.md) — detailed leave policy reference
