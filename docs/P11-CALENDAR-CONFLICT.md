# P11.3 — Calendar conflict markers

**Step ID:** `P11-CALENDAR-CONFLICT`  
**Flag:** `enable_syllabus_conflict_check` (shared with P11.1; no new migration)

Surfaces the same conflict rules as the dashboard banner on the **Calendar** tab.

## UI

| Surface | Behavior |
|---------|----------|
| Month grid | Days with any open-task conflict get `cal-day--conflict` (gold inset ring) + tooltip via `fluxT('syllabus.cal_marker')` |
| Day panel | `#calDayTasks` prepends `.cal-day-conflict-hint` with bullets for the selected date |
| Notices bar | `renderScheduleConflictNotices()` runs after each `renderCalendar()` |

## Hooks

- `public/js/flux-syllabus-conflict.js` — `conflictDatesSet`, `decorateCalendar`, `renderDayHint`
- `public/js/app.js` — `renderCalendar`, `renderCalDay`
- `public/css/flux-syllabus-conflict.css` — `.cal-day--conflict`, `.cal-day-conflict-hint`

## QA

| Action | Expected |
|--------|----------|
| Flag on, two quizzes same day | Conflict day highlighted; select day → hint list |
| Flag off | No markers; legacy exam banner only on dashboard |
| Locale es-US | Tooltip and hint title in Spanish |

See `docs/QA_MATRIX.md` §0m (calendar rows).

## Rollback

Disable `enable_syllabus_conflict_check` — calendar returns to prior styling; detection off.
