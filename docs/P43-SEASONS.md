# P43 — Seasons & Streak Cosmetics (C9)

**Step ID:** `P43-SEASONS`
**Flag:** `enable_seasons` (default **off**)
**District plan:** C9

Anti-burnout gamification: healthy behaviors earn seasonal cosmetics.
**No grades-based rewards anywhere** — grades never touch this module
(pinned by a unit test that scans every cosmetic definition).

## Behavior sources (existing events only)

| Source | Signal | XP | Daily cap |
|--------|--------|----|-----------|
| Focus session | `FluxBus session_ended` | 10 | 3 |
| Shutdown ritual | `FluxBus shutdown_completed` (P2-SHUTDOWN-V2) | 15 | 1 |
| Honoring quiet hours | yesterday had sessions, none inside the DND window | 10 | 1 |
| Group focus | `FluxSeasons.earn('group_focus')` from Study Rooms v2 (C8) | 20 | 2 |

## Streaks — never punish rest

Daily streak of healthy behavior. Gap days that are weekends or rest days
(`isBreak` — the existing sick/lazy days, plus C2 district closures)
auto-freeze the streak; only a missed *school* day resets it. This is the
"streak freeze consumes the existing sick/lazy days" contract.

## Cosmetics

Per-season sets (summer/autumn/winter/spring): three accents + one
confetti pack each, unlocked at 25/60/100/150 XP ("sparks"). Applying an
accent uses the existing accent storage (`flux_accent`/`flux_accent_rgb`)
— the theme engine is extended, not forked. Settings card shows streak,
sparks, unlocked (clickable) and locked (dashed, threshold shown) items
with calm copy.

## Storage / migration

`flux_seasons_v1` (registered in `FluxStorageKeys`) — localStorage only.
Flag seed: `20260711130000_seasons_flag.sql` (reversible).

## Telemetry

`season_cosmetic_unlocked` (student, persist, no payload).

## QA

`docs/QA_MATRIX.md` §0at. Unit: `test/unit/seasons.test.mjs` (8 tests —
caps, streak freeze incl. sick-day midweek, reset on missed school day,
single-fire unlocks, no-grade-linkage scan). E2E: `e2e/seasons.spec.ts`
3/3 (bus-driven earn + flag-off inert, settings card, apply/locked gate).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_seasons: true };
await FluxFeatureFlags.load({ force: true });
FluxBus.emit('session_ended', { mins: 25 });
```

## Rollback

Disable the flag: bus events no-op, the card disappears, `earn()` returns
null. The `flux_seasons_v1` store remains but is never consulted; applied
accents persist as the user's normal accent choice (their pick, not residue).
