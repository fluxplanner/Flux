# P45 — District hardening closeout (Phase D)

**Step ID:** `P45-DISTRICT-CLOSEOUT`
**Scope:** verification & release for Phase 38 (A1–A5, B1–B6, C1–C10).

## 1. E2E coverage (Phase D checklist)

| Required spec | File | Status |
|---------------|------|--------|
| Mobile More-sheet lifecycle | `e2e/mobile-more-sheet.spec.ts` | 8 tests |
| Palette junk-task repro | `e2e/palette-keyboard.spec.ts` | shipped with A3 |
| AI proposal-confirm flow | `e2e/agent-loop.spec.ts` (A4 additions) | shipped with A4 |
| Class-name preservation through onboarding | `e2e/class-identity.spec.ts` | 3 tests (Phase D) |
| Light-theme contrast smoke (axe-core) | `e2e/a11y.spec.ts` + `scripts/contrast-audit.mjs` (CI) | shipped with B3/B6 |
| Now-engine period math (midnight/weekends) | `test/unit/now-engine.test.mjs` + `e2e/now-engine.spec.ts` | 12 + 3 tests |
| Sub-plan share-code expiry | `e2e/sub-plans.spec.ts` + RLS §13 probes | 5 tests |

Plus per-feature happy paths: school-schedules, grade-gps, accommodation-
cards, family-digest, web-push, study-rooms-v2, seasons, ask-teacher.

**Final sweep (2026-07-11): 139 e2e — 131 passed, 8 skipped (env-gated
live-credential probes), 0 failed; 104/104 unit.** Two flakes found and
fixed during the sweep: an unhandled View-Transition rejection on rapid
double-nav (`transitionPanels` now catches `ready`/`updateCallbackDone` —
a real production defect, not just test noise) and a grade-gps spec racing
the module's deliberate post-nav re-render (spec now settles first).

## 2. QA matrix

Sections §0aa–§0au added phase-by-phase (roles × mobile/desktop noted per
row; every UI feature carries a 390px row).

## 3. Perf gate

B5 numbers recorded in the B5 closeout (fonts self-hosted with zero
third-party font requests; one shared DOM walker; 100-item windowing —
300 tasks render in 34.5ms; hashed bundles + precache + navigation
preload; SW auto-versioned by build hash). B5.5 (app.js source split) was
explicitly deferred. C7's Chromebook cold-start trace (<2s target) is a
deploy-time measurement — record alongside VAPID setup.

## 4. Security re-check

- **ai-proxy:** unauthenticated requests 401 regardless of
  `PAYMENTS_ENABLED` (A5; `e2e/ai-proxy.spec.ts`).
- **RLS probes:** all nine new C-phase tables added to
  `HIGH_RISK_TABLES` in `e2e/rls-boundary.spec.ts` — the anon baseline
  runs credential-free; two-user isolation runs with the
  `FLUX_TEST_USER_A/B` env pair. Detailed probes per table in
  `docs/RLS_AUDIT.md` §12–§17.
- **CSP verdict — corsproxy.io / api.allorigins.win:** RETAINED, scoped
  to `connect-src` only (never script/style). They are live fallbacks for
  Notebook URL-import and Teacher Resources link previews; removing them
  breaks those features. Risk statement for district review: URLs a user
  imports may transit these third-party proxies. Mitigation options if a
  district objects: disable Notebook web-import for the school, or route
  through the existing `canvas-proxy` edge function (backlog item — the
  clean fix, not done in this phase).

## 5. Docs

P30–P32, P38–P44 closeouts (house style: reasoning, architecture,
migration, flag, telemetry, QA, rollback) + `docs/ROADMAP.md` Phase 38
table. Internal architecture audit gained Areas 28/29 (school time,
accommodations) and the C-phase change-log row.

## 6. Rollback story (restated)

Every C feature disables fully via its flag with no residue: strips/cards
stop rendering, crons self-skip via the flag-registry kill switch
(family-digest, notify-push), wrapped v1 behaviors (cowork, openEdit,
next-class pill, sub-plan button) return byte-identical, and localStorage
stores go unconsulted. Tables drop via the rollback statements in each
migration header.
