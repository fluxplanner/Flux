# P42 — Study Rooms v2 (C8)

**Step ID:** `P42-STUDY-ROOMS-V2`
**Flag:** `enable_study_rooms_v2` (default **off**)
**District plan:** C8

Makes the existing ephemeral co-work rooms classroom-grade without touching
`flux-cowork.js` — v2 wraps its exported lifecycle.

## Pieces

- **Per-class templates:** "Study rooms" card in the School panel — one tap
  starts a co-work room on the student's next open task for that class
  (no task → helpful toast, no dead room).
- **Teacher study-hall mode:** Lesson Hub card listing live rooms for the
  teacher's own classes — **label + participant count + age only**. No room
  codes (teachers monitor, they don't join), no content — content is
  channel broadcast and never touches the server.
- **Registry:** `flux_study_rooms` (host-only RLS, no general SELECT);
  the host heartbeats `{label, class_code, participants}` every 60s and
  deactivates on leave; the RPC filters rows stale >10 min.
- **Group focus streak:** ≥2 people together ≥25 min → cosmetic grant via
  `FluxSeasons.earn('group_focus')` when C9 is present (calm toast
  fallback). Never grades-based.
- **Name guard (canonical):** `guardRoomLabel` — denylist with leet-fold
  (`sh!t` → `shit`) and spacing-squash (`k y s`), kind rejection copy
  ("Pick a kinder room name — classmates will see it."). No prior
  moderation util existed; new consumers should reuse this one.

## Migration

`20260711120000_study_rooms_v2.sql` — registry + study-hall RPC + flag
seed; reversible (header). RLS audit §17.

## Telemetry

`study_room_template_started`, `study_room_group_focus` (student, persist,
no payload).

## QA

`docs/QA_MATRIX.md` §0as. E2E: `e2e/study-rooms-v2.spec.ts` 4/4 (guard
incl. leet/spacing evasion, templates + no-task toast, study-hall
counts-only render, flag-off leaves v1 untouched).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_cowork: true, enable_study_rooms_v2: true };
await FluxFeatureFlags.load({ force: true });
```

## Rollback

Disable the flag: templates and study-hall cards stop rendering, the
heartbeat never starts, cowork v1 behavior is byte-identical (wrapper
no-ops). Registry rows go stale harmlessly; drop via migration rollback.
