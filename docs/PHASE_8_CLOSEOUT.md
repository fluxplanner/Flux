# Phase 8 closeout — Production hardening & staff productivity

**Status:** Roadmap slices **P8-SITE-ENH** through **P8-I18N-B** and **P9.1** dashboard widgets are implemented. Apply migrations and run exit checks before treating production as fully rolled out.

**Roadmap:** `docs/ROADMAP.md` Phase 8 (complete) · Phase 9 started (9.1 done).

---

## Step index

| ID | Doc | Primary deliverable |
|----|-----|---------------------|
| P8-ERRORS | `docs/P8-ERRORS.md` | `flux-error-reporter.js`, `enable_client_error_reporting` |
| P8-HEALTH | `docs/P8-HEALTH.md` | `flux-ops-health.js`, `enable_ops_health_panel` |
| P8-I18N | `docs/P8-I18N.md` | `flux-i18n.js`, `enable_locale_foundation` |
| P8-SITE-ENH | `docs/SITE_IMPROVEMENTS_50.md` | `flux-site-enhancements.js`, `enable_site_enhancements_pack` |
| P8-STAFF-PROD | `docs/P8-STAFF-PRODUCTIVITY.md` | `FluxModuleLoader`, staff SQL, child flags |
| P8-CLASSROOM | `docs/P8-STAFF-PRODUCTIVITY.md` §8.3 | `FluxClassroomTools` widgets |
| P8-CLASSROOM-B | `docs/P8-STAFF-PRODUCTIVITY.md` §8.4 | Oops broadcast + student alert banner |
| P8-COUNSELOR-B | — | Check-ins, referrals, crisis sheet (`20260528200000`) |
| P8-ADMIN-B | — | `FluxAdminWidgets` duty + sub swap |
| P8-SYSTEM-B | — | `FluxStaffCommand` ⌘K + Gmail quick import |
| P8-PILOT | `docs/P8-STAFF-PRODUCTIVITY.md` | `20260528300000` + `20260528700000` IA East overrides |
| P8-I18N-B | `docs/P8-I18N.md` | `fmtFluxDate` adoption in dashboard |
| P9-DASH-WIDGETS | `docs/P9-DASHBOARD-WIDGETS.md` | Show/hide dashboard sections |

---

## Migrations (apply in order)

Through **`20260528700000_ia_east_pilot_extended.sql`** on production:

| Migration | Purpose |
|-----------|---------|
| `20260527100000` | Site enhancements flag |
| `20260528100000` | Staff productivity suite tables + flags |
| `20260528200000` | Counselor check-ins + referrals |
| `20260528300000` | IA East staff suite pilot |
| `20260528400000` | Ops health panel + RLS snapshot extend |
| `20260528500000` | Locale foundation flag |
| `20260528600000` | Dashboard widget picker (default on) |
| `20260528700000` | IA East locale + ops health pilot |

```bash
supabase db push
```

---

## Feature flags (rollback surface)

| Flag | Default | Rollback effect |
|------|---------|-----------------|
| `enable_staff_productivity_suite` | off | Hides all staff widget grids |
| `enable_classroom_tools` | off | Classroom widgets off |
| `enable_caseload_engine` | off | Counselor P8 widgets off |
| `enable_personal_hub` | off | Personal hub widgets off |
| `enable_staff_command_v2` | off | Educator ⌘K = work/personal toggle only |
| `enable_school_ops` | off | School ops forecast + admin widgets |
| `enable_ops_health_panel` | off | System health widget hidden |
| `enable_locale_foundation` | off | en-US dates; no locale card |
| `enable_site_enhancements_pack` | **on** | Disable to remove enhancement pack |
| `enable_dashboard_widget_picker` | **on** | Disable → reorder-only layout UI |
| `enable_gmail_educator_import` | off | No Gmail → task import |

**IA East pilot** (`flux_school_feature_flags`) enables staff suite + locale + ops health for `International Academy East` without `FLUX_EXPERIMENTS`.

---

## Exit criteria

| Criterion | How to verify |
|-----------|----------------|
| Migrations applied | `supabase migration list --linked` through `20260528700000` |
| Student core protected | Sign in as student with all P8 staff flags **off** — dashboard/tasks unchanged |
| IAE educator pilot | IAE teacher/counselor/admin — widget grid + ⌘K commands without experiments |
| Counselor check-in | Student Profile → My counselor → send; counselor wellness queue |
| Admin health | `enable_ops_health_panel` → Operations → System health → all green |
| Locale | `enable_locale_foundation` → Español → due dates localized |
| Dashboard picker | Settings → Appearance → hide countdown → hidden on dashboard |
| QA matrix | `docs/QA_MATRIX.md` §§0f–0i, 0g staff suite |
| E2E | `npm run test:e2e` before large UI edits |

---

## Dev quick enable (non-IAE)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_staff_productivity_suite: true,
  enable_classroom_tools: true,
  enable_caseload_engine: true,
  enable_personal_hub: true,
  enable_staff_command_v2: true,
  enable_school_ops: true,
  enable_ops_health_panel: true,
  enable_locale_foundation: true,
  enable_gmail_educator_import: true,
};
await FluxFeatureFlags.load({ force: true });
location.reload();
```

---

## After Phase 8

1. **Production smoke** — IAE accounts per exit criteria above.  
2. **Selective enable** — other schools via `flux_school_feature_flags` or owner suite.  
3. **Phase 9 backlog** — remaining i18n UI strings, production smoke (IAE + widget picker).  
4. **`docs/PHASE_1_CLOSEOUT.md`** — re-run RLS checklist if enabling staff tables school-wide.
