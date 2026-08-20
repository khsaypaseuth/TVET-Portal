# TVED System — Prompt Pack for Cursor & Claude Code

How to use this file:
1. Put **Section 1** in your repo as `CLAUDE.md` (Claude Code reads it automatically) and as `.cursor/rules/project.mdc` (Cursor reads it automatically). One source of truth, two filenames.
2. Run the **Section 2** kickoff prompt once.
3. Then work through **Section 3** one phase at a time. One prompt per session, not all at once — long sessions drift.
4. Use **Section 4** patterns for review, debugging and testing.

Replace anything in `«angle brackets»` before running.

---

## Section 1 — `CLAUDE.md` / `.cursor/rules/project.mdc`

```markdown
# TVED Activity & Task Tracking System

## What this is
A bilingual (Lao/English) system for the Department of Technical and Vocational
Education and Training, Lao PDR. Two components in one Laravel monolith:

1. **Public website** — mobile-responsive, bilingual, informational, with a small CMS.
2. **Admin portal** — staff record tasks, activities, meetings and conferences with
   date/time ranges, then supervisors review them and generate hierarchical reports
   (weekly, monthly, quarterly, yearly, or a custom date range).

Think "a much smaller Asana for a government department." Simplicity beats features.

## Tech stack — do not substitute without asking
- PHP 8.3 / Laravel 12
- PostgreSQL 16
- Blade + Livewire 3 + Tailwind CSS 4
- Alpine.js for small interactions only. No React, no Vue, no SPA.
- Laravel Excel for .xlsx, Browsershot (headless Chrome) for PDF
- Chart.js for charts
- Pest for tests

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
  `HierarchyService::visibleUserIds(User $me)`. Never write an inline role check
  like `if ($user->role === 'HD')` in a controller, Livewire component or Blade view.
- Data scopes on the role: own | direct_reports | division | assigned_divisions | department.
- Every list query must be scoped. When in doubt, deny.

### Bilingual
- Lao is the DEFAULT locale. English is secondary.
- UI strings live in `lang/lo/*.php` and `lang/en/*.php`. Never hardcode a user-facing
  string in Blade — always `__('activity.create')`.
- User-generated content uses paired columns: `title_lo` / `title_en`. Lao is required,
  English optional, and display falls back to Lao when English is empty.
- Use the `x-t` Blade component or `tr($model, 'title')` helper for fallback display.
- Fonts: Noto Sans Lao (self-hosted from /public/fonts) for Lao, Inter for English.
- Lao text containers need `line-height: 1.8` and `overflow-wrap: anywhere` because
  Lao has no inter-word spaces and tall diacritics.
- Dates are Gregorian but formatted per locale via `FormatsDates::forLocale()`.
  Never call `->format('d/m/Y')` directly in a view.

### Activities
- `activities` is the core table. Fields: user_id, division_id, activity_type_id,
  title_lo, title_en, description, start_date, end_date, start_time, end_time,
  is_all_day, duration_minutes, location, status, progress_percent, priority,
  parent_activity_id, assigned_by_user_id, approved_by_user_id, approved_at.
- Status flow: draft → submitted → approved | rejected. Approved records are
  read-only except to the approver and Super Admin.
- `duration_minutes` is computed in the model's saving hook, never in a view.
- Validation: end_date >= start_date; if same date, end_time > start_time.
  Overlapping activities for the same user produce a warning, not an error.

### Code style
- Fat services, thin controllers. Business logic in `app/Services/`.
- Form Request classes for all validation. No `$request->validate()` in controllers.
- Migrations are never edited after being merged — add a new one.
- Every table has `created_at`, `updated_at`; `activities` and `users` also have
  `deleted_at` (soft deletes). Users are deactivated, never deleted.
- Name things in English in code. Lao appears only in `lang/` files and DB content.

### Testing
- Every authorisation rule gets a Pest feature test proving both the allow AND the deny case.
- Every report gets a test asserting the returned row count and total hours for a
  seeded fixture.

## Things that have gone wrong before — avoid these
- PDF libraries like DomPDF/TCPDF mangle Lao script. Use Browsershot only.
- Fixed-width buttons and table headers break because Lao strings are ~20% longer.
- Forgetting to scope a query leaks another division's data. Scope first, then build UI.
- Google Fonts CDN is slow/blocked on some Lao ministry networks. Self-host.

## Commands
- `php artisan test` — run tests
- `php artisan migrate:fresh --seed` — reset dev DB
- `npm run dev` / `npm run build`
- `./vendor/bin/pint` — format before committing
```

---

## Section 2 — Kickoff Prompt (run once)

> I'm building the TVED system described in CLAUDE.md. I already have an existing admin
> dashboard template located at `«path/to/template»` built with `«Bootstrap 5 / Tailwind / etc.»`.
>
> Before writing any code, do these three things and stop for my review:
>
> 1. Read my existing template and tell me which parts we should keep (layout shell,
>    sidebar, navbar, form components, card styles) and which we should rebuild. Be
>    specific about file names.
> 2. Propose the full folder structure for the Laravel project, showing where the public
>    site, the admin portal and the shared components live.
> 3. Write the complete database migration plan as a single markdown table listing every
>    table, its columns with types, and its foreign keys — covering: divisions, positions,
>    users, roles, permissions, role_permission, division_user_oversight, activity_types,
>    activities, activity_participants, activity_comments, attachments, audit_logs,
>    settings, and the public-site tables (pages, news, news_categories, documents,
>    banners, institutions, contact_messages).
>
> Do not generate migrations or models yet. Show me the plan, flag anything in my
> requirements that is ambiguous or that you think is a bad idea, and wait for my approval.

---

## Section 3 — Phase Prompts

### Phase 1 — Foundations

> Implement Phase 1 of the TVED system: foundations.
>
> **Scope**
> 1. All migrations from the approved plan, plus Eloquent models with relationships,
>    casts, and factories.
> 2. Seeders: 6 positions (DG, DDG, HD, DHD, TECH, ADMIN), 7 roles with data_scope,
>    `«N»` real divisions (use placeholders I will replace), 8 activity types, and one
>    Super Admin user.
> 3. Session auth: login with staff_code OR email, forgot password, forced password
>    change on first login, rate limiting 5 attempts/minute, 60-minute session timeout.
> 4. `HierarchyService` with: `descendants(User $u): Collection`,
>    `ancestors(User $u): Collection`, `visibleUserIds(User $u): array`.
>    Handle the tree recursively but cache the result per request. Include a guard
>    against circular supervisor references.
> 5. RBAC middleware + a `Gate::before` for Super Admin.
> 6. i18n: locale middleware, `lo` as default, `/{locale}/...` route prefix for the
>    public site, session-stored locale for the admin portal, `lang/lo` + `lang/en`
>    files, self-hosted Noto Sans Lao in `public/fonts` with an `@font-face` block,
>    and a Tailwind config exposing `font-lao` and `font-en`.
> 7. Audit logging trait applied to User and Activity.
> 8. The admin layout shell adapted from my existing template: sidebar whose items are
>    filtered by permission, topbar with language switcher and user menu.
>
> **Deliver in this order, pausing after each for me to run it:** migrations+models →
> seeders → auth → HierarchyService (+ its Pest tests) → i18n → layout.
>
> Write Pest tests for HierarchyService covering: a DG sees everyone; an HD sees only
> their division; a technical staff member sees only themselves; a circular reference
> does not cause infinite recursion.

### Phase 2 — Activity core

> Implement Phase 2: the activity recording module. This is the screen staff use every
> day, so entry speed matters more than anything else.
>
> 1. `ActivityService` handling create/update/delete, duration computation, and
>    overlap detection (returns warnings, does not block).
> 2. `StoreActivityRequest` / `UpdateActivityRequest` with the validation rules from
>    CLAUDE.md, and Lao + English validation messages.
> 3. Livewire component `ActivityForm`: activity type picker (icon + colour),
>    title_lo (required) / title_en (optional), rich-text description, date from/to,
>    time from/to with an "all day" toggle that hides the time fields, location,
>    participant selector (internal users via search + free-text external names),
>    file uploads (max 10MB, pdf/doc/xls/images), priority, progress slider.
>    Show computed duration live as the user types. Autosave drafts every 30 seconds.
> 4. Livewire component `ActivityList`: server-side filtering by date range, type,
>    status, and (for supervisors) staff member and division. Sortable, paginated,
>    with per-row quick actions and a "Duplicate" action that clones an activity to today.
> 5. Calendar view (month + week) rendering activities as coloured blocks by type.
> 6. Bulk entry screen: a table where a user adds up to 10 rows for one week and saves
>    them all in one transaction.
> 7. Activity detail page with comments and an attachment list.
>
> Every query in the list and calendar must go through `ActivityPolicy` /
> `visibleUserIds()`. Write feature tests proving a technical staff member cannot load,
> edit or delete a colleague's activity by ID.

### Phase 3 — Hierarchy views & approvals

> Implement Phase 3: supervision and approvals.
>
> 1. Complete `ActivityPolicy`: view, viewAny, create, update, delete, approve, reject —
>    driven entirely by `roles.data_scope` and `HierarchyService`.
> 2. Submit → approve/reject workflow with a rejection reason. Approved activities become
>    read-only. Record approver and timestamp.
> 3. Approvals queue page with bulk approve, filterable by staff and date.
> 4. "My team" page: for each direct report, show submitted/approved counts, total hours
>    this period, and a "not submitted" flag.
> 5. Task assignment: a supervisor creates an activity owned by a subordinate with
>    `assigned_by_user_id` set. It appears in the subordinate's "Assigned to me" tab.
> 6. Notifications (database channel + optional mail): assigned to you, approved,
>    rejected, and a Friday reminder to anyone with zero entries that week. Bell icon
>    with unread count in the topbar.
>
> Write feature tests for the full matrix in the plan: for each of the 7 roles, assert
> which activities are visible and which approval actions are permitted.

### Phase 4 — Reports & dashboards

> Implement Phase 4: reporting. This is what leadership judges the system on.
>
> 1. `ReportService` with one method per report type, all taking a
>    `ReportFilter` DTO (period_type, start_date, end_date, scope, user_ids,
>    division_ids, activity_type_ids, statuses):
>    - individual activity report
>    - division summary (per staff: activity count, total hours, breakdown by type)
>    - department summary (per division roll-up)
>    - meetings & conferences register with participants
>    - compliance report (submitted vs not submitted for the period)
> 2. Period presets: this/last week (Mon–Sun), month, quarter, year, and custom range.
>    Read the fiscal-year start from settings so quarters are configurable.
> 3. Report builder UI: pick period → scope → filters → preview on screen → export.
> 4. **Excel export** via Laravel Excel: styled headers, TVED letterhead rows, frozen
>    header row, totals row, one sheet per division for department reports.
> 5. **PDF export** via Browsershot rendering a Blade template. The template must embed
>    Noto Sans Lao as base64 or an absolute file path so Chromium finds it. Prove Lao
>    renders correctly before building the rest — write a one-page smoke test PDF first
>    and show it to me.
> 6. Any report projected over 5,000 rows dispatches a queued job and notifies the user
>    when the file is ready.
> 7. Role-aware dashboard: staff / HD / DG variants as described in the plan, with
>    Chart.js charts for activity-by-type, hours-by-week, and activity-by-division.
>
> Add the indexes needed for these queries and show me `EXPLAIN` output for the division
> summary query against 50,000 seeded activities.

### Phase 5 — Public website

> Implement Phase 5: the public bilingual website. Mobile-first — design at 360px, then
> scale up.
>
> 1. Routes under `/{locale}` where locale ∈ {lo, en}, with `lo` as the default and a
>    language switcher that preserves the current page and query string.
> 2. Pages: home (banner slider, latest 6 news, quick links, stats counters), about,
>    organisational structure with leadership cards, divisions, news index +
>    category filter + detail, events calendar, documents library with search and
>    download counter, TVET institutions directory filterable by province and type,
>    photo gallery, contact page with a form and map.
> 3. Admin CMS screens for news, pages, documents, banners, institutions and contact
>    messages — all with side-by-side Lao/English input tabs.
> 4. SEO: per-locale meta title/description, Open Graph tags, hreflang alternates,
>    sitemap.xml, robots.txt.
> 5. Performance: lazy-loaded images with width/height set, WebP conversion on upload,
>    cached homepage queries, total JS under 100KB.
> 6. Accessibility: semantic landmarks, alt text fields in the CMS, visible focus states,
>    AA contrast.
>
> Verify at 360px, 768px and 1440px. Explicitly check that long Lao headings wrap
> instead of overflowing, and that no button has a fixed width.

### Phase 6 — Hardening & launch

> Phase 6: prepare for production.
>
> 1. Security pass: check every route for missing authorisation, every upload for MIME
>    validation, every form for CSRF, and serve uploaded files through a signed
>    controller route rather than from the public directory. Report findings as a
>    table before fixing.
> 2. Add security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
> 3. Seed 50 users and 20,000 activities, then profile the 10 slowest queries and fix
>    the N+1s.
> 4. Backup script: nightly pg_dump + uploads tar, 30-day rotation, plus a documented
>    restore procedure.
> 5. Deployment: `.env.example`, deploy script, queue worker supervisor config, nginx
>    config, and a README covering server requirements including Chromium for PDF.
> 6. A user manual in Lao (markdown) covering: login, recording an activity, submitting,
>    approving, and generating each report.

---

## Section 4 — Reusable Prompt Patterns

**Before a big change**
> Before writing code, list the files you will create or modify and describe the approach
> in 5 bullets. Wait for my approval.

**Security review of what was just built**
> Review the code you just wrote as a hostile security reviewer for a government system.
> For each issue give: file, line, severity, and the fix. Pay specific attention to
> authorisation bypass — can a Technical Staff user reach another division's data through
> any route, filter parameter, export or ID enumeration?

**Bilingual audit**
> Scan `resources/views` and `app/Livewire` for hardcoded user-facing strings that should
> be translation keys, and for any `->format(` date call that bypasses the locale helper.
> Output a table of file, line, current text, and suggested key. Do not fix yet.

**When a fix does not work**
> That did not work — `«exact error»`. Do not try another fix yet. First give me three
> possible root causes ranked by likelihood, and tell me what to log or inspect to
> distinguish between them.

**Test generation**
> Write Pest feature tests for `«feature»`. Cover the happy path, each validation failure,
> and the authorisation denial for every role that should not have access. Use factories,
> not hardcoded IDs. Show me the tests before running them.

**Keeping scope small**
> Implement only «X». Do not refactor unrelated files, do not add packages, and do not
> improve anything I did not ask about. If you think something else needs changing,
> list it at the end instead of doing it.
