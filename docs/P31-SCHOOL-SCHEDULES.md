# P31 — District Schedule Authority (C2)

**Step ID:** `P31-SCHOOL-SCHEDULES`
**Flag:** `enable_school_schedules` (default **off**)
**District plan:** C2

Admins publish bell-schedule variants (assembly day, 2-hr delay, exam week)
and calendar exceptions (variant per date, or closure) school-wide; every
member's planner reflows automatically.

## Architecture

- **Module:** `public/js/flux-school-schedules.js` (`FluxSchoolSchedules`).
- **Tables:** `flux_school_bell_schedules` (school TEXT, label, periods
  jsonb `[{label,start,end}]`, is_default) and `flux_school_calendar_days`
  (school TEXT, date, schedule_id | closed, note). Keyed on
  `user_roles.school` — the codebase's membership model (the plan's
  `school_id` was adapted; see the migration header).
- **RLS:** members read (same school), `admin` role writes. RLS also scopes
  client SELECTs, so the module fetches with no school filter.
- **Cache:** `flux_school_sched_cache_v1` (registered in `FluxStorageKeys`)
  — 45-day horizon of days + variants, refreshed ~2.5s after boot.
- **Reflow:** `isBreak()` in app.js ORs in `FluxSchoolSchedules.isClosed()`,
  so closures behave exactly like `REST_DAYS_KEY` rest days everywhere
  (due-date spreading, calendar chips, AI pacing) with zero data mutation.
  New closures with due work raise an undoable proposal toast (snapshot →
  move to next open day → undo snackbar).
- **FluxNow (C1):** `todayOverride()` — closures render as calm holiday
  sentences with the note; variants expose their periods.
- **Admin UI:** injected card in Admin Operations (variant editor with
  `P1 10:15-10:55, …` shorthand, calendar painter, "Broadcast snow day"
  riding `FluxSchoolEmergency.setBroadcast` / `school_announcements`).
- **Students are zero-config:** `join_flux_school` stamps
  `user_roles.school`; RLS does the rest.

## Migration

`20260710100000_school_schedules.sql` — tables + RLS + flag seed; reversible
(rollback statements in the header). RLS audit: `docs/RLS_AUDIT.md` §12.

## Telemetry

None yet — admin actions land as table rows (auditable), student surfaces
reuse `now_strip_opened`. Add publish events when the district pilot needs
them.

## QA

`docs/QA_MATRIX.md` §0am. E2E: `e2e/school-schedules.spec.ts` (closure ⇒
rest-day + FluxNow holiday; flag-off inert; admin card role-gated).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_school_schedules: true, enable_now_engine: true };
await FluxFeatureFlags.load({ force: true });
await FluxSchoolSchedules.refresh();
```

## Rollback

Disable the flag: `isClosed`/`dayInfo`/`todayOverride` all return inert
values, the admin card stops rendering, `refresh()` no-ops. The cache key
remains but is never consulted; tables drop cleanly via the migration
rollback. No residue in student data (closures never mutate rest days or
tasks — the reflow proposal is explicit and undoable).
