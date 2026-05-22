# Phase 37.1 PR-C — IA East school flag profile

**Tenant:** `International Academy East` (`user_roles.school` / `flux_schools.name`)  
**School key:** `International Academy East` (case-insensitive match in `flux_resolve_feature_flags`)  
**Baseline:** post-`aa96bba` · **Date:** 2026-05-21

---

## 1. Current school overrides (repo source of truth)

Applied by migrations (idempotent `ON CONFLICT DO UPDATE`):

| Flag | Enabled | Migration | Role / scope |
|------|---------|-----------|--------------|
| `enable_staff_productivity_suite` | true | `20260528300000` | Master staff OS |
| `enable_classroom_tools` | true | `20260528300000` | Teacher work widgets |
| `enable_caseload_engine` | true | `20260528300000` | Counselor private logs / caseload widgets |
| `enable_personal_hub` | true | `20260528300000` | Educator personal mode |
| `enable_staff_command_v2` | true | `20260528300000` | Staff ⌘K palette |
| `enable_school_ops` | true | `20260528300000` | Admin overload intel |
| `enable_locale_foundation` | true | `20260528700000` | i18n / Intl formatting |
| `enable_ops_health_panel` | true | `20260528700000` | Admin system health |
| `enable_syllabus_conflict_check` | true | `20260529100000` | Student exam-stack banner |
| `enable_counselor_caseload` | true | `20260533900000` | Counselor caseload dashboard (PR-C add) |

**Explicitly off at IAE (unless manually enabled):**

- `enable_gmail_educator_import` — requires Google OAuth scope review
- Phase 12–36 micro-slices — global default off; no IAE school row

---

## 2. Core flags (no school row required)

Hardcoded ON in client (**PR-B**, `aa96bba`):

- `enable_staff_google_hub`
- `enable_dashboard_widget_picker`
- `enable_site_enhancements_pack`

Unflagged product core (**stabilization `46d0541`**):

- Post-auth routing (`fluxRouteAfterAuth`)
- Counselor booking / `counselor_availability_slots`
- Staff verification / approval flow
- `ensureCounselorRecord` (strict email)

---

## 3. PR-C promotion analysis

Pilot migrations date from Phase 8–11 (`20260528300000` → `20260529100000`). At IAE these have been the daily workflow path for **2+ weeks** (production pilot).

### Promoted to global `default_enabled = true` (PR-C migration)

These remain in `flux_school_feature_flags` for IAE (harmless redundancy) but now resolve **true for all schools** unless a school override sets `enabled = false`:

| Flag | Why promote |
|------|-------------|
| `enable_staff_productivity_suite` | IAE educator daily driver |
| `enable_classroom_tools` | Teacher workboard widgets |
| `enable_caseload_engine` | Counselor workboard widgets |
| `enable_personal_hub` | Educator personal mode tools |
| `enable_staff_command_v2` | Staff command palette |
| `enable_locale_foundation` | Stable locale foundation |
| `enable_syllabus_conflict_check` | Low-risk student banner |

### Kept IAE-only (school override, global default stays false)

| Flag | Why not global |
|------|----------------|
| `enable_school_ops` | Admin aggregate intel — enable per district |
| `enable_ops_health_panel` | Owner/admin diagnostic — not for all tenants |

### Added IAE-only (PR-C)

| Flag | Why school row only |
|------|---------------------|
| `enable_counselor_caseload` | Consent-gated; enable at pilot school first |

---

## 4. Prod verification SQL

**Full IAE override inventory:**

```sql
SELECT school_key, flag_key, enabled, updated_at
FROM public.flux_school_feature_flags
WHERE lower(trim(school_key)) = lower(trim('International Academy East'))
ORDER BY flag_key;
```

**Effective flags for an IAE user** (replace `:user_id`):

```sql
SELECT public.flux_resolve_feature_flags()
FROM auth.users
WHERE id = :user_id;
```

**Global defaults after PR-C:**

```sql
SELECT key, default_enabled, category
FROM public.flux_feature_flags
WHERE key IN (
  'enable_staff_productivity_suite',
  'enable_classroom_tools',
  'enable_caseload_engine',
  'enable_personal_hub',
  'enable_staff_command_v2',
  'enable_locale_foundation',
  'enable_syllabus_conflict_check'
)
ORDER BY key;
```

---

## 5. Rollback

| Scope | Action |
|-------|--------|
| Single flag globally | `UPDATE flux_feature_flags SET default_enabled = false WHERE key = '…';` |
| IAE only | `UPDATE flux_school_feature_flags SET enabled = false WHERE school_key = 'International Academy East' AND flag_key = '…';` |
| PR-C migration | Re-run inverse `UPDATE … default_enabled = false` for promoted keys |

---

## 6. Related docs

- `docs/P9-PRODUCTION-SMOKE.md` — manual IAE smoke (no `FLUX_EXPERIMENTS`)
- `docs/P8-STAFF-PRODUCTIVITY.md` — suite widget catalog
- `docs/P37-FLAG-AUDIT.md` — Phase 37.1 master audit
