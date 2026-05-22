# Phase 37.1 — Feature flag audit

**Baseline commit:** `46d0541` · **Closed:** PR-C @ `20260533900000`  
**Date:** 2026-05-21

## 1. Inventory summary

| Metric | Value |
|--------|--------|
| Flags in client defaults (`flux-feature-flags.js`) | ~93 (after PR-A orphan removal) |
| `isEnabled` call sites | ~85 modules + routing |
| Orphan flags removed (PR-A) | **2** |
| Core hardcoded ON (PR-B) | **3** — staff Google hub, dashboard widget picker, site enhancements pack |
| IAE-promoted global defaults (PR-C) | **7** — staff suite cluster + locale + syllabus conflict |

**Core paths intentionally unflagged** (stabilization): `fluxRouteAfterAuth`, counselor booking, staff verification, `ensureCounselorRecord`.

**IAE school profile:** [`docs/P37-IAE-SCHOOL-PROFILE.md`](P37-IAE-SCHOOL-PROFILE.md)

## 2. Orphan flags (PR-A) — done

| Key | Issue | Replacement |
|-----|--------|-------------|
| `enable_counselor_insights` | No module reference | `enable_counselor_wellness_timeline` |
| `enable_cognitive_predictions` | No module reference | `enable_predict_v2` |

Migration: `20260533800000_cleanup_orphan_flags.sql`

## 3. PR-B — default-on trio (hardcoded)

Runtime `isEnabled` removed; DB keys retained for metadata.

| Flag | Modules |
|------|---------|
| `enable_staff_google_hub` | `app.js`, `flux-google-hub.js`, `flux-role-routing.js` |
| `enable_dashboard_widget_picker` | `flux-personalization.js` |
| `enable_site_enhancements_pack` | `flux-site-enhancements.js` |

Commit: `aa96bba`

## 4. PR-C — IAE school profile

### School overrides (10 rows for `International Academy East`)

| Flag | Source |
|------|--------|
| Staff suite + classroom + caseload + personal + ⌘K + school ops | `20260528300000` |
| Locale + ops health | `20260528700000` |
| Syllabus conflict | `20260529100000` |
| Counselor caseload | `20260533900000` (PR-C add) |

### Promoted to global `default_enabled = true`

`enable_staff_productivity_suite`, `enable_classroom_tools`, `enable_caseload_engine`, `enable_personal_hub`, `enable_staff_command_v2`, `enable_locale_foundation`, `enable_syllabus_conflict_check`

### IAE-only (school override; global default false)

`enable_school_ops`, `enable_ops_health_panel`

Migration: `20260533900000_ia_east_promote_global_defaults.sql`

## 5. Prod verification SQL

```sql
-- Global registry
SELECT key, default_enabled, category
FROM public.flux_feature_flags
ORDER BY category, key;

-- IAE overrides
SELECT school_key, flag_key, enabled, updated_at
FROM public.flux_school_feature_flags
WHERE lower(trim(school_key)) = lower(trim('International Academy East'))
ORDER BY flag_key;
```

## 6. Phase 37.1 exit criteria

- [x] PR-A — orphan removal
- [x] PR-B — promote default-on trio (hardcoded)
- [x] PR-C — IAE school flag profile + global promotion migration
- [ ] 37.2 — QA consolidation + CI flag smoke
- [ ] 37.3 — migration closeout matrix

See `docs/ROADMAP.md` § Phase 37 and `docs/GEMINI-HANDOFF.md`.
