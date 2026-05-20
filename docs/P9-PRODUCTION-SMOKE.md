# P9.5 — Production smoke (IA East + Phase 9)

**Step ID:** `P9-PRODUCTION-SMOKE`  
Manual checklist for International Academy East pilot and Phase 9 student polish. Complements automated E2E (`docs/P7-TESTS.md`).

## Prerequisites

- Migrations through `20260529100000_ia_east_syllabus_conflict.sql` applied (`supabase db push`).
- Test accounts at `user_roles.school = International Academy East` for each role.
- No `FLUX_EXPERIMENTS` in production — flags come from `flux_school_feature_flags` + global defaults.

## IAE school overrides (expected)

| Flag | IAE via school row |
|------|-------------------|
| Staff suite + classroom + caseload + personal hub + ⌘K + school ops | `20260528300000` |
| Locale foundation | `20260528700000` |
| Ops health panel | `20260528700000` |
| Syllabus conflict check | `20260529100000` |
| Gmail educator import | **off** unless added manually |

Global defaults: `enable_dashboard_widget_picker` **on**, `enable_site_enhancements_pack` **on**.

---

## Student (`student` @ IAE)

| # | Action | Pass |
|---|--------|------|
| 1 | Sign in, open dashboard | Tasks, pulse, schedule load; no blank overlay |
| 1b | Two quizzes same due date | Schedule conflicts banner (IAE pilot) lists exam stack |
| 2 | Settings → Appearance → hide **Exam countdown** | `#countdownCard` hidden after reload |
| 3 | Settings → Appearance → Español (locale on) | Date pill + task due dates localized |
| 4 | Core with staff flags **off** (guest or non-IAE) | No staff widget grid on student dashboard |

## Teacher (`teacher` @ IAE, work mode)

| # | Action | Pass |
|---|--------|------|
| 1 | Open teacher dashboard | **Workspace modules** grid visible without experiments |
| 2 | Widget: Quick-Grade or Hall pass | Module body renders |
| 3 | ⌘K (staff command) | Command palette opens (not work/personal toggle only) |
| 4 | Locale Español | Greet subline uses localized date |

## Counselor (`counselor` @ IAE)

| # | Action | Pass |
|---|--------|------|
| 1 | Counselor dashboard + widget grid | Caseload / meeting log widgets available |
| 2 | Student profile → counselor check-in | Message appears in wellness queue |
| 3 | Meeting log entry | Timestamp formatted (not raw ISO) |

## Admin (`admin` @ IAE)

| # | Action | Pass |
|---|--------|------|
| 1 | Operations → System health | Panel loads; RLS row present |
| 2 | School dashboard greet date | Localized when locale on |

## Optional (dev flags)

| # | Flags | Action | Pass |
|---|-------|--------|------|
| 1 | `enable_offline_sync` + `enable_sync_conflict_ui` | Two-device task conflict | Preview modal + Settings → Data card |
| 2 | Rollback | Disable conflict UI flag only | Legacy two-button modal |

---

## Automated smoke (CI-local)

```bash
npm run test:e2e
```

New scenarios (harness `?e2e=1&scenario=…`):

| Scenario | Validates |
|----------|-----------|
| `ia-east-teacher` | IAE pilot flags + teacher widget grid |
| `ia-east-counselor` | IAE flags + counselor dashboard loads |
| `student-dashboard-widgets` | Dashboard sections + hide countdown |

Manual harness examples:

```
/?e2e=1&scenario=ia-east-teacher
/?e2e=1&scenario=student-dashboard-widgets
```

## Rollback

Remove or disable IAE rows in `flux_school_feature_flags`; disable global flags in Owner Suite / `flux_feature_flags`.
