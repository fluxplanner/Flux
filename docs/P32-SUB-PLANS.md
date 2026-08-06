# P32 — Sub-Plan Generator (C3)

**Step ID:** `P32-SUB-PLANS`
**Flag:** `enable_sub_plans` (default **off**)
**District plan:** C3

One click in Lesson Hub turns today's bell-by-bell lesson notes into a clean
printable page plus an unguessable share code a substitute can open
read-only with no account.

## Architecture

- **Module:** `public/js/flux-sub-plans.js` (`FluxSubPlans`).
- **Data in:** today's `classes` (times/rooms, A1's `periodLabel`) + Lesson
  Hub's existing `flux_lesson_state_v1` store (per-period notes, attendance,
  materials). No new local storage.
- **Template sections:** schedule table, per-period plan, "if you finish
  early", emergency-info placeholders, teacher contact preference (pulled
  from the teacher school-info extension when set).
- **Button upgrade:** capture-phase listener on `#lhSubPlanBtn`; flag off ⇒
  the legacy clipboard behavior in `flux-staff-tabs.js` is untouched.
- **Publish:** `flux_sub_plans` insert with a crypto-random 10-char code and
  `expires_at = now()+48h`; the share URL is `?subplan=CODE`.
- **Viewer:** boot-time check for `?subplan=` renders a white read-only page
  before/independent of auth (subs have no account); expired/unknown codes
  get friendly messages. Print button included.
- **Audit:** every successful RPC view inserts a `flux_sub_plan_views` row;
  owners can read their plan's audit trail.

## Migration

`20260710110000_sub_plans.sql` — tables + owner-only RLS + code-keyed
SECURITY DEFINER RPC + flag seed; reversible (header). RLS audit §13.

## Telemetry

`sub_plan_published` (educator, persist, no payload).

## QA

`docs/QA_MATRIX.md` §0an. E2E: `e2e/sub-plans.spec.ts` (payload builder,
composer modal, viewer render, expiry message, flag-off legacy) — the live
publish→fetch→expiry path is covered by the RLS §13 probes.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_sub_plans: true };
await FluxFeatureFlags.load({ force: true });
```

## Rollback

Disable the flag: the button reverts to the legacy clipboard template, the
composer never opens, no fetches occur. Existing share links keep working
until their 48h expiry (or drop the tables via the migration rollback to
kill them immediately). No local residue.
