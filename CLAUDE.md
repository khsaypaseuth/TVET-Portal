# TVED Activity & Task Tracking System

## What this is
A bilingual (Lao/English) system for the Department of Technical and Vocational
Education and Training, Lao PDR. Two components:

1. **Public website** — mobile-responsive, bilingual, informational, with a small CMS.
2. **Admin portal** — staff record tasks, activities, meetings and conferences with
   date/time ranges, then supervisors review them and generate hierarchical reports
   (weekly, monthly, quarterly, yearly, or a custom date range).

Think "a much smaller Asana for a government department." Simplicity beats features.

## Tech stack — do not substitute without asking
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4 (TailAdmin shell)
- Backend: Express 5 + TypeScript + `pg` + JWT
- Database: PostgreSQL (`tvet_portal`)
- i18n: i18next (Lao default, English secondary)
- Charts: ApexCharts
- Calendar: FullCalendar
- Excel: ExcelJS
- PDF: Puppeteer (headless Chromium) — never DomPDF-style libraries for Lao text
- Tests: add Vitest/Jest for services when introducing critical logic

## Organisational hierarchy
Director General (DG) → Deputy DG (DDG) → Head of Division (HD) →
Deputy Head of Division (DHD) → Technical Staff / Administrative Staff.
Super Admin sits outside the hierarchy and operates the system.

Two separate concepts, never conflate them:
- `positions` = job title (DG, DDG, HD, DHD, TECH, ADMIN)
- `users.supervisor_id` = the actual reporting line, a self-referencing tree

## Non-negotiable rules

### Authorisation
- ALL activity visibility flows through `ActivityPolicy` and
  `HierarchyService.visibleUserIds(user)`. Never write an inline role check
  like `if (user.role === 'HD')` in a controller or React page for data access.
- Data scopes on the role: own | direct_reports | division | assigned_divisions | department.
- Every list query must be scoped. When in doubt, deny.

### Bilingual
- Lao is the DEFAULT locale. English is secondary.
- UI strings live in `src/i18n/locales/lo.json` and `en.json`. Never hardcode a
  user-facing string in JSX — always `t('key')`.
- User-generated content uses paired columns: `title_lo` / `title_en`. Lao is required,
  English optional, and display falls back to Lao when English is empty.
- Fonts: Noto Sans Lao (self-hosted) for Lao, Inter for English.
- Lao text containers need `line-height: 1.8` and `overflow-wrap: anywhere`.
- Dates are Gregorian but formatted per locale via a shared helper. Never hardcode
  `toLocaleDateString` inconsistently.

### Activities
- `activities` is the core table. Status flow: draft → submitted → approved | rejected.
  Approved records are read-only except to the approver and Super Admin.
- `duration_minutes` is computed in the service on save, never only in the view.
- Validation: end_date >= start_date; if same date, end_time > start_time.
  Overlapping activities for the same user produce a warning, not an error.
- Maximum span per activity: 31 days. Retroactive entry max 14 days (Super Admin override).

### Code style
- Fat services, thin controllers. Business logic in `server/src/services/`.
- Migrations are never edited after being applied — add a new one.
- Soft-delete users/activities (`deleted_at` / `is_active`). Never hard-delete users.
- Name things in English in code. Lao appears only in locale files and DB content.

### Auth
- JWT Bearer tokens. Accounts are created by Super Admin only (no public signup).
- Login by staff_code OR email.

## Commands
- Frontend: `npm run dev` (Vite, :5173)
- Backend: `cd server && npm run dev` (Express, :5001)
- Migrate: `cd server && npm run migrate`
- Seed: `cd server && npm run seed`
