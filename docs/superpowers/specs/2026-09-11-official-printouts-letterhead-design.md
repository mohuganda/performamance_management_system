# Official Printouts (MoH Letterhead) — Design

**Date:** 2026-09-11  
**Status:** Approved for planning  
**Product:** MoH Uganda Performance Management System

## Problem

1. Approved performance plans (PPA), quarterly reports (Q1–Q3), final appraisals, leave, and out-of-station lack a consistent **official** print layout.
2. Current leave/OOS print is a plain dialog (`window.print`); performance has no per-document official print.
3. There is no editable Ministry letterhead (address/contacts) and no way for a third party to **verify** a printed document via this system.

## Goals

1. High-quality **browser print → Save as PDF** using a shared MoH memo-style HTML template.
2. Letterhead: existing coat of arms, centered **MINISTRY OF HEALTH**, tagline, body, editable address/contacts footer.
3. Footer **QR code** linking to a **public** validity page (no login).
4. Settings section for admins to edit letterhead contact/address fields.
5. Same template for leave, out-of-station, and approved performance documents (plan, Q1–Q3, final appraisal).

## Non-goals

- Server-side PDF generation (Go PDF libraries / Gotenberg).
- jsPDF one-click download for these official forms (list/table exports may stay as-is).
- Putting full KPI actuals / narrative detail on the public verify page.
- Replacing the Attend `memo-pdf` system; borrow layout ideas only (centered crest + ministry title + footer).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Output | Browser print → Save as PDF (Approach A) |
| Template | Shared HTML/CSS print layout (memo style) |
| QR verify | Public page, no login |
| Print gate | Official Print only when document **status = approved** |
| Letterhead storage | `system_configs` group `letterhead` |
| Logo | Existing `uganda-coat-of-arms.svg` / `BrandLogo` asset (not a new upload in v1) |
| Document types | `ppa`, `quarterly_report`, `appraisal`, `leave_request`, `oos_request` |

## Layout (print page)

```
        [Coat of arms — centered]
        MINISTRY OF HEALTH
        (optional tagline / PMS - iHRIS)

        Document title (e.g. Performance Plan / Leave Approval)
        Reference / FY / quarter as applicable

        … document body (staff, period, summary tables/fields,
           approval status and dates) …

        ────────────────────────────────────────
        MoH address & contacts (from Settings)
        [QR] Scan to verify authenticity on MoH PMS
```

Print CSS: hide app chrome/nav; A4-friendly margins; high-contrast black text; avoid large colored backgrounds.

## Workstream A — Letterhead settings

### Keys (`letterhead.*`, mostly `is_public=true`)

| Key | Default |
|-----|---------|
| `org_name` | Ministry of Health |
| `org_title_line` | MINISTRY OF HEALTH |
| `tagline` | Republic of Uganda · Performance Management System |
| `address_line` | Plot 6, Lourdel Road, Nakasero, Kampala |
| `postal_address` | P.O. Box 7272, Kampala, Uganda |
| `phone` | +256 417 712260 |
| `toll_free` | 0800-100-066 |
| `email` | info@health.go.ug |
| `website` | https://www.health.go.ug |
| `footer_note` | Scan the QR code to verify this document on the MoH PMS. |

### Admin UI

- New Settings tab **Letterhead** (permission: reuse `settings` manage / existing settings admin permission).
- Form to edit fields above; Save via existing `PUT /api/v1/admin/settings` `{ group: "letterhead", payload }`.
- Seed defaults in `system_config_seeder.go`.
- Expose via `PublicSettings()` / `GET /api/v1/config` so print + verify pages can load branding without auth.

## Workstream B — Document verification

### Storage

New table `document_verifications`:

| Column | Notes |
|--------|--------|
| `id` | PK |
| `token` | unique opaque string (URL-safe) |
| `document_type` | enum-like string |
| `ref_id` | source row id |
| `staff_id` | nullable |
| `title` | short display title |
| `period_label` | e.g. FY 2025/26 · Q1 |
| `status` | snapshot at issue (`approved`) |
| `issued_at` | timestamp |
| `issued_by` | user id nullable |
| `revoked_at` | nullable |

Issue token **idempotently** when opening official print for an approved document (reuse existing token for same `document_type` + `ref_id` if not revoked).

### APIs

- Authenticated: `POST /api/v1/documents/verification` `{ document_type, ref_id }` → `{ token, verify_url, qr_payload }` (creates or returns existing).
- Public: `GET /api/v1/verify/documents/{token}` → JSON validity summary (no sensitive content).
- Public SPA route: `/verify/:token` — branded read-only page (valid / not found / revoked).

QR encodes `verify_url` built from `app.public_url` + `/verify/{token}`.

### Public payload (JSON + page)

- Organisation name / title  
- Document type label  
- Title / period  
- Staff display name (or “Staff member”)  
- Status (`approved`)  
- Issued at  
- Valid: yes/no  

Do **not** expose KPI scores, narratives, or medical/sensitive leave reasons beyond a high-level type if needed.

## Workstream C — Shared print UI

### Components

- `OfficialPrintShell` — letterhead header + footer (address + QR) wrapping children.
- `useLetterhead()` — loads public config letterhead fields.
- `useDocumentVerification(type, refId)` — ensures token + QR data URL when printing approved docs.
- Print trigger: dedicated print view (new window or in-app print-only route) then `window.print()`.

### Consumers

| Document | Gate | Body content (v1) |
|----------|------|-------------------|
| Leave | `approved` | Staff, type, dates, days, status, approver trail summary |
| Out of station | `approved` | Staff, destination, dates, status, trail summary |
| PPA / plan | `approved` | Staff, FY, KPI list (code, statement, weight, target), approval date |
| Quarterly report Q1–Q3 | `approved` | Staff, quarter, KPI actuals summary table, approval date |
| Final appraisal | `approved` | Staff, FY, scores/summary sections available in UI, approval date |

Wire Print buttons on Performance page (plan / report / appraisal tabs when approved) and replace leave/OOS dialog print with the official shell.

## Workstream D — Permissions & security

- Issuing verification tokens: authenticated user who can view the document.
- Public verify: rate-limit friendly (simple GET); no PII beyond name + document meta.
- Revoke: optional admin later; v1 can leave `revoked_at` unused or set on hard-delete of source if easy.

## Testing

- Seed letterhead defaults; Settings save round-trip.
- Issue token twice → same token.
- Public verify returns valid for known token; 404 for unknown.
- Print shell renders logo + MINISTRY OF HEALTH + footer; QR present for approved docs.
- Print button absent or disabled when not approved.

## Out of scope follow-ups

- Logo upload override in Settings.
- Server PDF email attachments.
- Digital cryptographic signatures.
