# Phase 7 closeout — Infrastructure & scale

**Status:** All roadmap steps **P7-EVENT-BUS** through **P7-TESTS** are implemented in code. Run exit checks below before a production release.

**Roadmap:** `docs/ROADMAP.md` Phase 7 (complete).

---

## Step index

| ID | Doc | Primary deliverable |
|----|-----|---------------------|
| P7-EVENT-BUS | `docs/P7-EVENT-BUS.md` | `flux_processor_jobs`, `flux-event-processors.js` |
| P7-AI-ORCH | `docs/P7-AI-ORCH.md` | `flux-ai-orch-layer.js`, orchestration flag |
| P7-OFFLINE | `docs/P7-OFFLINE.md` | `flux-offline-sync.js`, conflict log |
| P7-MEMORY | `docs/P7-MEMORY.md` | `flux-layered-memory.js`, reset RPC |
| P7-PARENT | `docs/P7-PARENT.md` | `flux-parent-portal.js`, invite/claim RPCs |
| P7-A11Y | `docs/P7-A11Y.md` | `flux-a11y.js`, calm + ADHD layout |
| P7-TESTS | `docs/P7-TESTS.md` | Playwright + `flux-e2e-harness.js` |

---

## Exit criteria

| Criterion | How to verify |
|-----------|----------------|
| Migrations applied | `supabase migration list --linked` through `20260525460000_e2e_harness.sql` |
| Flags default off | New P7 flags (`enable_event_bus_processors`, `enable_ai_orchestration`, `enable_offline_sync`, `enable_layered_memory`, `enable_parent_portal`, `enable_a11y_suite`, `enable_e2e_harness`) resolve **false** for normal users |
| E2E green | `npm run test:e2e` (7 tests) — also runs in GitHub Actions |
| Manual smoke | `docs/QA_MATRIX.md` §§32–39 for touched roles |
| Student core protected | Dashboard/tasks/calendar work with all P7 flags **off** |

---

## After Phase 7

The **master roadmap** (`docs/ROADMAP.md`) has no Phase 8 yet. Suggested follow-ups:

1. **Push + apply migrations** on production Supabase.
2. **Manual QA** — full `docs/QA_MATRIX.md` pass.
3. **Enable flags selectively** per school via `flux_feature_flags` overrides.
4. **Backlog** — `IMPROVEMENTS.md` and new Phase 8 planning when you pick the next theme (e.g. CI hardening, i18n, sync conflict UI).
