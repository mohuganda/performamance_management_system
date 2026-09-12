# Official Printouts (MoH Letterhead) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared MoH letterhead browser-print templates for approved PPA, Q1–Q3 reports, final appraisal, leave, and OOS, with editable letterhead settings and public QR verification.

**Architecture:** Letterhead lives in `system_configs` (`letterhead.*`). Official print is HTML + `window.print`. Verification tokens in `document_verifications`; QR encodes `{public_url}/verify/{token}`. Public SPA page + JSON API for scanners.

**Tech Stack:** Goravel (Go), React, Tailwind `print:` utilities, `qrcode` (npm) for QR rendering.

## Global Constraints

- Output: browser print → Save as PDF only (no server PDF in v1).
- Official Print only when status is `approved`.
- Public verify page: no login; no KPI scores / sensitive narratives.
- Logo: existing coat of arms asset; no logo upload in v1.
- Defaults: Plot 6 Lourdel Road; P.O. Box 7272; +256 417 712260; 0800-100-066; info@health.go.ug; health.go.ug.

---

### Task 1: Document verification backend

**Files:**
- Create: `backend/database/migrations/20260911000001_create_document_verifications.go`
- Create: `backend/app/services/document_verification_service.go`
- Create: `backend/app/http/controllers/document_verification_controller.go`
- Create: `backend/app/services/document_verification_service_test.go`
- Modify: `backend/app/models/pms.go` (add `DocumentVerification`)
- Modify: `backend/bootstrap/migrations` (or wherever migrations register)
- Modify: `backend/routes/api.go`

**Produces:** `EnsureVerification(userID, type, refID) (token, verifyURL)`, `LookupPublic(token)`

- [ ] Add model + migration for `document_verifications`
- [ ] Implement idempotent ensure + public lookup
- [ ] Unit-test token reuse / unknown token
- [ ] Routes: auth `POST /documents/verification`, public `GET /verify/documents/{token}`
- [ ] Commit

### Task 2: Letterhead settings

**Files:**
- Modify: `backend/database/seeders/system_config_seeder.go`
- Modify: `backend/app/services/settings_service.go` (`letterheadConfig`, Admin/Public/UpdateGroup)
- Modify: `frontend/src/constants/settingsPermissions.ts` (optional: fold under preferences)
- Modify: `frontend/src/modules/settings/SettingsPage.tsx` + tab nav
- Modify: RBAC seeder only if new permission needed — prefer `settings.preferences.manage` / `settings.manage`

**Produces:** Public `settings.letterhead` object on `/api/v1/config`

- [ ] Seed defaults
- [ ] Wire settings service
- [ ] Settings UI Letterhead tab/form
- [ ] Commit

### Task 3: Shared print shell + verify page

**Files:**
- Create: `frontend/src/components/organisms/OfficialPrintShell.tsx`
- Create: `frontend/src/hooks/useLetterhead.ts`
- Create: `frontend/src/hooks/useDocumentVerification.ts`
- Create: `frontend/src/api/services/documents.ts`
- Create: `frontend/src/modules/verify/DocumentVerifyPage.tsx`
- Modify: `frontend/src/app/routes/AppRoutes.tsx`
- Modify: `frontend/package.json` (add `qrcode` / `@types/qrcode` if needed)
- Create: print CSS helpers in `frontend/src/index.css` (`@media print` for `.official-print-*`)

**Produces:** Reusable shell with crest, MINISTRY OF HEALTH, footer+QR

- [ ] Install `qrcode`
- [ ] Shell + hooks + verify page (public route)
- [ ] Commit

### Task 4: Leave + OOS official print

**Files:**
- Modify: `frontend/src/components/molecules/RequestDetailDialog.tsx`
- Modify: `frontend/src/modules/leave/LeavePage.tsx`
- Modify: `frontend/src/modules/out-of-station/OutOfStationPage.tsx`

- [ ] Gate Print to approved
- [ ] Wrap body in OfficialPrintShell with verification
- [ ] Commit

### Task 5: Performance official print (plan, Q reports, appraisal)

**Files:**
- Create: `frontend/src/components/performance/OfficialPerformancePrint.tsx` (or similar)
- Modify: `frontend/src/modules/performance/PerformancePage.tsx`

- [ ] Print buttons when PPA / report / appraisal approved
- [ ] Print views with KPI summary tables
- [ ] Commit

### Task 6: Docs smoke + push readiness

- [ ] Note deploy: migrate + seed letterhead (or rely on FirstOr seed path)
- [ ] Manual checklist in plan footer
