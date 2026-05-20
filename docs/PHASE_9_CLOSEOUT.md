# Phase 9 closeout — Student experience polish

**Status:** Roadmap steps **9.1–9.5** implemented. Run production smoke before wide rollout.

**Roadmap:** `docs/ROADMAP.md` Phase 9.

---

## Step index

| ID | Doc | Deliverable |
|----|-----|-------------|
| 9.1 | `docs/P9-DASHBOARD-WIDGETS.md` | Show/hide + reorder dashboard sections |
| 9.2 | `docs/PHASE_8_CLOSEOUT.md` | Phase 8 exit + IAE locale/ops pilot extension |
| 9.3 | `docs/P9-SYNC-CONFLICT.md` | Enhanced conflict resolver UI |
| 9.4 | `docs/P9-I18N-EDUCATOR.md` | Locale dates in staff/educator panels |
| 9.5 | `docs/P9-PRODUCTION-SMOKE.md` | IAE manual smoke + E2E harness scenarios |

---

## Migrations (Phase 9 touch)

| Migration | Purpose |
|-----------|---------|
| `20260528600000` | `enable_dashboard_widget_picker` (default on) |
| `20260528700000` | IAE locale + ops health school overrides |
| `20260528800000` | `enable_sync_conflict_ui` |

Phase 8 staff migrations remain prerequisite — see `docs/PHASE_8_CLOSEOUT.md`.

```bash
supabase db push
```

---

## Exit criteria

| Criterion | How to verify |
|-----------|----------------|
| Migrations applied | Through `20260528800000` on production |
| Student widget picker | Settings → Appearance → hide section → dashboard respects |
| IAE teacher pilot | Widget grid without `FLUX_EXPERIMENTS` |
| Sync conflict v2 | Both offline + conflict UI flags → preview modal |
| Educator dates | Locale on → counselor meeting log / admin greet localized |
| E2E green | `npm run test:e2e` includes `ia-east-pilot` + `student-dashboard-widgets` specs |
| Manual IAE smoke | `docs/P9-PRODUCTION-SMOKE.md` checklist signed off |

---

## After Phase 9

1. **Commit + push** full working tree when ready.  
2. **IAE live smoke** with real accounts per `P9-PRODUCTION-SMOKE.md`.  
3. **Phase 10** — see `docs/ROADMAP.md` (10.1 storage repair shipped).  
4. **Backlog** — remaining i18n UI strings, AI export dates, other `IMPROVEMENTS.md` items.
