# Phase 37.1 — Feature flag audit

**Baseline commit:** `46d0541`  
**Date:** 2026-05-21

## 1. Inventory summary

| Metric | Value |
|--------|--------|
| Flags in client defaults (`flux-feature-flags.js`) | ~95 |
| `isEnabled` call sites | ~85 modules + `app.js` / routing |
| Orphan flags (DB + defaults, no module) | **2** |
| Default-on trio (SQL + client) | `enable_staff_google_hub`, `enable_dashboard_widget_picker`, `enable_site_enhancements_pack` |

**Core paths intentionally unflagged** (post-stabilization): `fluxRouteAfterAuth`, counselor booking / `counselor_availability_slots`, staff verification, `ensureCounselorRecord`.

## 2. Orphan flags (PR-A)

| Key | Issue | Replacement |
|-----|--------|-------------|
| `enable_counselor_insights` | Never referenced by `FluxFeatureFlags.isEnabled` | `enable_counselor_wellness_timeline` |
| `enable_cognitive_predictions` | Never referenced by any module | `enable_predict_v2` (if needed) |

## 3. Prod verification SQL

```sql
SELECT key, default_enabled, category
FROM public.flux_feature_flags
ORDER BY category, key;
```

School / user overrides for orphans (should be empty after PR-A):

```sql
SELECT * FROM public.flux_school_feature_flags
WHERE flag_key IN ('enable_counselor_insights', 'enable_cognitive_predictions');

SELECT * FROM public.flux_user_feature_flags
WHERE flag_key IN ('enable_counselor_insights', 'enable_cognitive_predictions');
```

## 4. Categorization (next PRs)

### Promote (merge or treat as core)

- [x] **PR-B:** Default-on trio — runtime `isEnabled` removed; keys kept in `flux_feature_flags` for metadata/overrides
- IAE daily workflow flags (confirm in `flux_school_feature_flags` before promoting): `enable_staff_productivity_suite`, `enable_classroom_tools`, `enable_caseload_engine`, `enable_counselor_caseload`, `enable_locale_foundation`

### Keep flagged

- Phase 12–36 micro-slices (default off)
- District / parent / e2e / heavy integrations

### Cleanup (this phase)

- [x] PR-A: remove orphan keys (`20260533800000_cleanup_orphan_flags.sql`)
- [x] PR-B: hardcode default-on trio (`app.js`, `flux-google-hub.js`, `flux-role-routing.js`, `flux-personalization.js`, `flux-site-enhancements.js`)

## 5. Phase 37 exit criteria

- [x] PR-A — orphan removal
- [x] PR-B — promote default-on trio (inline branches)
- [ ] PR-C — IAE school flag profile documented
- [ ] 37.2 — QA consolidation + CI flag smoke
- [ ] 37.3 — migration closeout matrix

See `docs/ROADMAP.md` § Phase 37 and `docs/GEMINI-HANDOFF.md`.
