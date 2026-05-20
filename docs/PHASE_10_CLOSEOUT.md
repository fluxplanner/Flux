# Phase 10 closeout — Reliability & data hygiene

**Status:** Steps **10.1–10.2** complete. Builds on Phase 9 exit (`docs/PHASE_9_CLOSEOUT.md`).

---

## Step index

| ID | Doc | Deliverable |
|----|-----|-------------|
| 10.1 | `docs/P10-STORAGE-REPAIR.md` | `flux-storage-repair.js`, `enable_storage_repair` |
| 10.2 | `docs/P10-I18N-STRINGS.md` | `fluxT` for sync, storage, widget picker UI |

Phase 9 recap: `docs/PHASE_9_CLOSEOUT.md`.

---

## Migrations (Phase 9–10)

| Migration | Purpose |
|-----------|---------|
| `20260528700000` | IAE locale + ops health pilot |
| `20260528800000` | `enable_sync_conflict_ui` |
| `20260528900000` | `enable_storage_repair` |

```bash
supabase db push
```

---

## Exit criteria

| Criterion | Verify |
|-----------|--------|
| Migrations applied | Through `20260528900000` |
| Storage repair | Flag on → corrupt JSON → Scan & repair |
| Locale strings | `enable_locale_foundation` → Español → sync modal / layout labels |
| E2E | `npm run test:e2e` (11 tests) |
| IAE manual smoke | `docs/P9-PRODUCTION-SMOKE.md` |

---

## After Phase 10

1. **IAE production smoke** with real accounts (no `FLUX_EXPERIMENTS`).  
2. **Phase 11** — complete; see `docs/PHASE_11_CLOSEOUT.md`.  
3. **Phase 12+** — `docs/IMPROVEMENTS.md`, AI export dates, broader i18n.
