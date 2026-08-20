# TVED Activity & Task Tracking System — Development Plan

**Client:** Department of Technical and Vocational Education and Training (TVED)
**Deliverables:** (1) Public bilingual website, (2) Staff admin portal for task/activity recording and hierarchical reporting
**Languages:** Lao (default) + English
**Positioning:** "A much smaller Asana" — simple, opinionated, built for a government department hierarchy

---

## 1. Goals & Non-Goals

### Goals
- Every staff member records what they did: tasks, activities, meetings, conferences, field missions, training.
- Each record has **date from → date to**, **time from → time to**, description, type, and status.
- Supervisors see their subordinates' work rolled up automatically.
- Reports for **weekly / monthly / quarterly / yearly / custom date range**, exportable to PDF and Excel.
- A public website that presents TVED to the outside world, editable by staff without a developer.

### Non-Goals (v1)
- Gantt charts, dependencies, sprint boards, resource levelling.
- Payroll, HR leave balances, or performance scoring.
- Mobile native apps (the web app is responsive; a PWA is optional in Phase 6).
- Public user registration. Accounts are created by Super Admin only.

---

## 2. Users, Roles & Permissions

### 2.1 Organisational hierarchy

```
Director General (DG)
└── Deputy Director General (DDG)          [1..n, each may oversee 1..n divisions]
    └── Head of Division (HD)              [one per division]
        └── Deputy Head of Division (DHD)  [0..n per division]
            └── Technical Staff            [n]
            └── Administrative Staff       [n]

Super Admin — outside the hierarchy, system operator
```

Model this as **two separate things**, not one:
- **Position / job title** (DG, DDG, HD, DHD, Technical, Admin) — an attribute of the user.
- **Reporting line** (`users.supervisor_id`) — a self-referencing tree used for roll-up.

This lets you handle real-world messiness (an acting HD, a technical staff reporting directly to a DDG) without changing code.

### 2.2 Permission matrix

| Capability | Super Admin | DG | DDG | HD | Deputy HD | Technical | Admin Staff |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Create/edit own activity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own activities | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View direct reports' activities | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View whole division | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View assigned divisions | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View entire department | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve / reject submissions | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign task to another user | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Generate division report | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Generate department report | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage public website content | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage users, roles, divisions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage master data (activity types, etc.) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Rule of thumb to implement once, in one place:** a user can read an activity if
`activity.user_id == me` **OR** `activity.user_id ∈ descendants(me)` **OR** `me.scope == 'department'`.
Put this in a single scope/policy class. Do not scatter role checks through controllers.

---

## 3. Domain Model

### 3.1 Core tables

**divisions**
`id, code, name_lo, name_en, parent_id (nullable, for sub-units), head_user_id, sort_order, is_active`

**users**
`id, staff_code, first_name_lo, last_name_lo, first_name_en, last_name_en, email, phone, password_hash, position_id, division_id, supervisor_id, role_id, avatar_path, locale_pref ('lo'|'en'), is_active, last_login_at`

**positions**
`id, code (DG|DDG|HD|DHD|TECH|ADMIN), name_lo, name_en, rank_level (1=DG … 5=staff)`

**roles / permissions / role_permission**
Standard RBAC. Add `roles.data_scope` = `own | direct_reports | division | assigned_divisions | department`.

**divisions_user_oversight** (for DDG → multiple divisions)
`id, user_id, division_id`

**activity_types**
`id, code, name_lo, name_en, colour, icon, requires_location, is_active`
Seed: Task, Meeting, Conference/Seminar, Training, Field Mission, Official Trip, Report Writing, Other.

**activities** — the heart of the system
```
id
user_id                 -- owner (whose report it appears in)
division_id             -- denormalised for fast filtering
activity_type_id
title_lo, title_en      -- title_en optional
description             -- rich text
start_date, end_date    -- DATE, end_date >= start_date
start_time, end_time    -- TIME, nullable when is_all_day
is_all_day              -- boolean
duration_minutes        -- computed & stored on save
location
status                  -- draft | submitted | approved | rejected | cancelled
progress_percent        -- 0..100
priority                -- low | normal | high | urgent
parent_activity_id      -- nullable, one level of sub-tasks only
assigned_by_user_id     -- nullable, set when a supervisor assigns it
approved_by_user_id, approved_at, rejection_reason
created_at, updated_at, deleted_at (soft delete)
```

**activity_participants** — who else attended the meeting/conference
`id, activity_id, user_id (nullable), external_name, role_in_activity`

**attachments**
`id, activity_id, file_path, original_name, mime_type, size_bytes, uploaded_by`

**activity_comments**
`id, activity_id, user_id, body, created_at`

**audit_logs**
`id, user_id, action, auditable_type, auditable_id, old_values (json), new_values (json), ip_address, user_agent, created_at`

**settings**
`key, value_json` — org name, fiscal year start, working hours, logo, contact info.

### 3.2 Public website tables

**pages** `id, slug, title_lo, title_en, body_lo, body_en, template, is_published, published_at`
**news** `id, slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en, cover_image, category_id, published_at, is_featured, view_count`
**news_categories** `id, slug, name_lo, name_en`
**documents** `id, title_lo, title_en, file_path, category, file_size, download_count, published_at`
**banners** `id, image_path, title_lo, title_en, link_url, sort_order, is_active`
**public_events** `id, title_lo, title_en, description_lo, description_en, start_date, end_date, location_lo, location_en` — optionally auto-fed from approved `activities` where `is_public = true`
**contact_messages** `id, name, email, phone, subject, message, is_read, created_at`
**institutions** `id, name_lo, name_en, province, type, address, phone, website, lat, lng` — the TVET college/school directory, usually the highest-traffic page on a TVET site

### 3.3 Validation rules worth writing down now
- `end_date >= start_date`; if same date and both times present, `end_time > start_time`.
- Warn (do not block) when a new activity overlaps an existing one for the same user.
- Maximum span per activity: 31 days (longer = create a "project" style parent).
- Once `status = approved`, the record is read-only except to the approver and Super Admin.
- Deleting a user never deletes activities — deactivate instead.

---

## 4. Feature Breakdown

### 4.1 Admin portal — MVP

**Auth**
Email/staff-code + password login, remember me, forgot password, forced password change on first login, session timeout, optional 2FA for Super Admin.

**Dashboard (role-aware)**
- Staff view: my hours this week, activities by status, upcoming items, quick-add button.
- HD/DHD view: division totals, staff who submitted nothing this week, pending approvals count.
- DG/DDG view: department totals, activity by division bar chart, activity type breakdown, submission compliance %.

**Activity entry** — this screen must be fast, it is used daily
- Modal or single-page form: type → title → date from/to → time from/to (or "all day") → description → location → participants → attachments.
- Duration auto-calculated and shown live.
- "Duplicate" button to copy yesterday's entry.
- Draft autosave.
- Bulk-entry mode: add several rows for one week in a single table.

**Views**
- List view with filters (date range, type, status, division, staff) + saved filters.
- Calendar view (month/week) of my or my team's activities.
- Kanban by status — optional, low priority.

**Approvals**
Submit → supervisor sees queue → approve / reject with reason → notification back to owner. Bulk approve.

**Task assignment**
A supervisor creates an activity with `user_id = subordinate` and `assigned_by_user_id = self`. It appears in the subordinate's list as "Assigned to me".

**Notifications**
In-app bell + optional email: assigned to you, submission approved/rejected, weekly reminder every Friday for anyone with zero entries.

**Admin/master data**
Users, divisions, positions, roles, activity types, settings, audit log viewer.

### 4.2 Reporting module

Report builder with these inputs:
`period type (week | month | quarter | year | custom) → date range → scope (me | staff member | division | department) → activity types → status`

Report outputs:
1. **Individual activity report** — chronological table: date, time, type, title, description, hours, status.
2. **Division summary** — per staff member: number of activities, total hours, by type, completion %.
3. **Department summary** — per division roll-up + charts.
4. **Meetings & conferences register** — filtered to those types, with participant lists.
5. **Compliance report** — who has and has not submitted for the period.

Exports: **PDF** and **Excel (.xlsx)**, both bilingual, with TVED letterhead.

> ⚠️ **Lao text in PDF is the classic failure point.** Do not use DomPDF/TCPDF — Lao script shaping and line-breaking will be wrong. Generate PDFs with **headless Chromium** (Browsershot / Puppeteer / Gotenberg) rendering an HTML template with Noto Sans Lao. Budget half a day to prove this works before Phase 4.

### 4.3 Public website — MVP

Pages: Home (banner slider, latest news, quick links, stats), About TVED (mandate, structure, org chart, leadership), Divisions, News & Announcements (list + detail + category), Events calendar, Documents & Laws (downloadable PDFs with search), TVET Institutions directory (filter by province/type, map), Photo/Video gallery, Contact (form + map + phone).

Every page has a `/lo/...` and `/en/...` URL. Language switcher in the header. Mobile-first: the majority of Lao traffic is phone-based, so design for 360px width first.

Also: SEO meta per language, Open Graph tags, sitemap.xml, Google Analytics, and a visitor counter (government sites in the region conventionally show one).

### 4.4 Phase 2 backlog (agree now, build later)
Projects/programmes grouping activities · KPI targets vs actual · Leave requests · Document approval workflow · Budget tracking per activity · Mobile PWA with offline entry · SSO with ministry accounts · Public API.

---

## 5. Bilingual (Lao / English) Specification

**Font stack**
```css
--font-lo: 'Noto Sans Lao', 'Phetsarath OT', sans-serif;
--font-en: 'Inter', 'Noto Sans', sans-serif;
```
Self-host Noto Sans Lao (weights 400/500/600/700) rather than hot-linking Google Fonts — connectivity to Google CDN from Laos can be slow and some ministry networks filter it. Subset to Lao + Latin.

**Layout rules for Lao**
- Lao has no spaces between words; the browser will not break lines well. Set `word-break: break-word; overflow-wrap: anywhere;` on Lao text containers and test at 360px.
- Lao glyphs have tall ascenders/descenders. Use `line-height: 1.8` for Lao body text (vs 1.5 for English) or Lao will look cramped and vowel marks will collide.
- Lao strings run ~15–25% longer than English. Never fix button or table-header widths.

**Content strategy**
- **UI labels** → translation files (`lang/lo.json`, `lang/en.json`). Lao is the default locale.
- **User content** (news, pages, activity titles) → paired DB columns `*_lo` / `*_en`. Lao required, English optional with fallback to Lao.
- **Dates** → Gregorian calendar, but format per locale: `08/08/2026` (en) vs `ວັນທີ 08 ສິງຫາ 2026` (lo). Provide a `formatDate($date, $locale)` helper and use it everywhere.
- Numbers stay in Arabic numerals (0-9) — Lao digits are not used in government reporting.

---

## 6. Technical Architecture

### 6.1 Recommended stack (default — swap if your template dictates otherwise)

| Layer | Choice | Why |
|---|---|---|
| Backend | **Laravel 12 (PHP 8.3)** | Cheapest hosting in the region, easiest handover to local devs, batteries included (auth, queues, policies, localisation) |
| Admin UI | **Filament 4** or Blade + Livewire + Tailwind | Filament gives you 70% of the admin portal for free; use Blade+Livewire if you must keep your purchased template's look |
| Public site | Blade + Tailwind (server-rendered) | SEO, fast on 3G, no JS framework needed |
| Database | **PostgreSQL 16** (MySQL 8 acceptable) | Better JSON, window functions for reporting |
| Charts | Chart.js or ApexCharts | |
| Excel export | Laravel Excel (PhpSpreadsheet) | |
| PDF export | **Browsershot / Gotenberg (headless Chrome)** | Correct Lao rendering — non-negotiable |
| Search | Postgres full-text | Avoid Elasticsearch at this scale |
| Queue/Cache | Redis (or database driver if the server is tiny) | |
| Auth | Laravel Breeze/Fortify sessions | No SPA token complexity needed |

**Alternative stack** if your existing template is React-based: Next.js 15 (App Router) + Prisma + PostgreSQL + NextAuth + shadcn/ui + `next-intl`. The domain model and phases in this document are unchanged.

### 6.2 Repository structure (monolith — recommended for a team this size)
```
tved/
├── app/
│   ├── Models/
│   ├── Policies/               # ActivityPolicy — all visibility logic
│   ├── Services/
│   │   ├── HierarchyService.php   # descendants(), ancestors(), scope resolution
│   │   ├── ReportService.php
│   │   └── ExportService.php
│   ├── Http/Controllers/{Admin,Public,Api}/
│   └── Livewire/
├── database/{migrations,seeders,factories}/
├── lang/{lo,en}/
├── resources/views/{admin,public,reports,components}/
├── public/fonts/noto-sans-lao/
└── tests/{Feature,Unit}/
```

### 6.3 Non-functional requirements
- **Security:** HTTPS only, bcrypt/argon2 passwords, CSRF, rate-limited login (5/min), all uploads validated by MIME + extension + size (10MB), stored outside webroot and served through a signed controller route. Audit every create/update/delete on `activities` and `users`.
- **Backup:** nightly `pg_dump` + uploads to off-server storage, 30-day retention, restore tested once before go-live.
- **Performance:** report queries indexed on `(user_id, start_date)`, `(division_id, start_date)`, `(status)`. Any report over 5,000 rows runs as a queued job and emails the file.
- **Availability:** target 99% during working hours. Nightly maintenance window 01:00–02:00.
- **Browser support:** Chrome/Edge/Firefox latest 2, Safari iOS 15+, Android Chrome. (Check whether any TVED office still runs IE11 — if yes, the public site needs a graceful fallback.)

---

## 7. Delivery Plan

| Phase | Scope | Duration | Key output |
|---|---|---|---|
| **0. Discovery & setup** | Confirm open decisions (§8), collect real division list & staff list, finalise UI kit from existing template, repo + CI + staging server | 1 week | Signed-off spec, running skeleton |
| **1. Foundations** | Auth, RBAC + data scopes, users/divisions/positions CRUD, i18n scaffolding, layout from template, audit log | 2 weeks | Login works, Super Admin can create the whole org tree |
| **2. Activity core** | Activity CRUD, types, validation, attachments, participants, list + calendar views, quick-add & duplicate | 3 weeks | Staff can record daily work |
| **3. Hierarchy & approvals** | Visibility policy, supervisor views, submit/approve/reject, assignment, notifications | 2 weeks | Supervisors see and approve their teams |
| **4. Reports & dashboards** | Report builder, 5 report types, PDF + Excel export with Lao fonts, role-aware dashboards & charts | 2.5 weeks | Weekly/monthly/quarterly/yearly reports produced |
| **5. Public website** | Public pages, news/documents/institutions CMS, bilingual routing, SEO, responsive polish | 2.5 weeks | Public site live on staging |
| **6. Hardening & launch** | Security review, load test, backup/restore drill, UAT fixes, data migration, user manual (Lao), training | 2 weeks | Production go-live |

**Total: ~13 weeks** for one full-stack developer. Two developers working public-site/admin-portal in parallel from Phase 2 brings it to ~9 weeks.

**Milestone demos:** end of Phase 2 (staff data entry), end of Phase 4 (the report a DG actually wants to see), end of Phase 5 (public site). Get DG sign-off at each — reporting format is the item most likely to be revised late.

---

## 8. Open Decisions — Confirm Before Coding

1. **Fiscal year start** — do quarters run Jan–Dec or Oct–Sep? This changes every quarterly report.
2. **Approval mandatory or optional?** If staff must submit weekly, what is the deadline and who chases?
3. **Retroactive entry limit** — can staff add an activity for last month? Suggest: 14 days, Super Admin can override.
4. **Is English content mandatory** for every news post, or Lao-only with English optional?
5. **Existing staff data** — is there a spreadsheet to import, or is data entered manually?
6. **Hosting** — ministry server, local VPS, or cloud? Affects PDF generation (headless Chrome needs ~512MB RAM headroom).
7. **Email sending** — is there a working SMTP relay on the ministry domain? If not, notifications become in-app only.
8. **Does the public site need to publish activities/events automatically** from approved records, or is public content entered separately?
9. **Existing template** — which framework, and do you own a licence permitting modification?

---

## 9. Sample Acceptance Criteria (write the rest in this style)

- **AC-01** A Technical Staff user who logs in sees only their own activities in every list, calendar and report. Attempting to open another user's activity by ID returns 403.
- **AC-02** A Head of Division selecting "Division report, 1–31 August" sees every approved activity of every active staff member in their division, and no one else's.
- **AC-03** Exporting that report to PDF produces a file where all Lao text renders with correct vowel and tone-mark placement and no `□` boxes, verified on a machine without Lao fonts installed.
- **AC-04** An activity with start 08:00 and end 12:00 on the same date displays a duration of 4h 00m; a 3-day all-day activity displays 3 days.
- **AC-05** Switching the public site from Lao to English preserves the current page (`/lo/news/abc` → `/en/news/abc`) and does not return 404.
- **AC-06** On a 360px-wide screen, no page has horizontal scroll and no Lao text is clipped.
