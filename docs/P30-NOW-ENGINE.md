# P30 — Bell-aware "Now" engine (C1)

**Step ID:** `P30-NOW-ENGINE`
**Flag:** `enable_now_engine` (default **off**)
**District plan:** C1

One module — `FluxNow` (`public/js/flux-now-engine.js`, new canonical owner
for school-time) — answers "where are we in the school day?" for every
surface: a glanceable strip under the top bar, the AI planner context, and
the next-class pill (which defers to the strip when the flag is on).

## Reasoning

Students and staff glance for "what's next, where, how long" dozens of times
a day. That logic previously lived in three half-implementations
(`updateNextClassPill` with legacy `AB_MAP` only, the dashboard gap filler,
ad-hoc AI prompt lines). FluxNow is the single resolver; C2's district bell
variants plug into `resolveLive` (`FluxSchoolSchedules.todayOverride` hook is
already in place).

## Architecture

- **Pure core** `resolveNow({now, classes, cycleLabel, isRest, isEducator})`
  → `{state, sentence, cls?, next?, minutesLeft?, minutesUntil?}`.
  States: `before | period | passing | after | weekend | holiday | untimed |
  none`. One calm sentence per state — no countdown-panic tone.
- **Sources of truth:** `flux_classes` (times/rooms/days incl. A1's
  `periodLabel`), `getCycleDayLabel` (cycle-day engine), `isBreak`
  (`REST_DAYS_KEY`), `FluxRole.isEducator` (phrasing: "You teach …").
- **Strip:** `#fluxNowStrip` button inserted after `.topbar`, refreshed every
  30s (paused while `document.hidden`); tap → `nav('calendar')` (today's
  timeline). CSS: `flux-now-engine.css`.
- **AI:** `FluxNow.aiContext()` adds one line to `buildAIPrompt`'s
  student context. `FluxNow.gapUntilNext()` exposes the free-gap minutes for
  gap-task surfaces.
- **Unification:** `updateNextClassPill` hides the legacy pill and delegates
  to the strip when the flag is on.

## Migration

`20260710090000_now_engine_flag.sql` — flag-registry seed only, reversible
(`DELETE … WHERE key='enable_now_engine'`). No tables.

## Telemetry

`now_strip_opened` in `FluxTelemetry.CATALOG` (student, persist, no payload
beyond `schema_version`).

## QA

`docs/QA_MATRIX.md` §0al. Unit: `test/unit/now-engine.test.mjs` (midnight,
weekend, boundary math — 12 tests). E2E: `e2e/now-engine.spec.ts` (3 tests:
off-residue, strip happy path, AI context line).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_now_engine: true };
await FluxFeatureFlags.load({ force: true });
FluxNow.renderStrip();
```

## Rollback

Disable the flag: the strip hides itself (`stop()`), `updateNextClassPill`
returns to its legacy behavior, `aiContext()` returns `''`. No residue —
no storage keys, no tables.
