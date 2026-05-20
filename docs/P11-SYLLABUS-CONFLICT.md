# P11.1 — Syllabus / schedule conflict check

**Step ID:** `P11-SYLLABUS-CONFLICT`  
**Flag:** `enable_syllabus_conflict_check` (default **off**)

Extends the dashboard notices bar with richer conflict detection. When the flag is off, legacy `renderExamConflictBanner()` (two tests same day) still runs.

## Rules

| Kind | Trigger |
|------|---------|
| Exam stack | 2+ tests/quizzes due same day |
| Heavy day | 4+ open items due same day |
| Subject clash | Same subject: test/quiz **and** homework due same day |
| Duplicate due | Same normalized title + subject twice same day (syllabus re-import) |

Shows up to 5 bullets + “+N more” in `#examConflictBanner`.

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_syllabus_conflict_check: true };
await FluxFeatureFlags.load({ force: true });
renderScheduleConflictNotices();
```

Seed: two quizzes same date, or same name twice on one date.

## Rollback

Disable flag → legacy heavy-day banner only.

Migration: `20260529000000_syllabus_conflict_check.sql`

## IA East pilot

School override: `20260529100000_ia_east_syllabus_conflict.sql` enables the flag for `International Academy East` students without `FLUX_EXPERIMENTS`.

Banner refreshes when `renderTasks()` runs (add/edit/complete/delete tasks).

## P11.3 — Calendar markers

**Step ID:** `P11-CALENDAR-CONFLICT` (same flag, no new migration)

When `enable_syllabus_conflict_check` is on:

- Month grid cells with conflicts get class `cal-day--conflict` and a localized `title` tooltip.
- Selected day panel (`#calDayTasks`) shows a gold hint block listing conflicts for that date.
- `renderCalendar()` calls `decorateCalendar()` and `renderScheduleConflictNotices()` so the dashboard banner stays in sync when switching to Calendar.

API: `FluxSyllabusConflict.conflictDatesSet()`, `conflictsForDate(iso)`, `decorateCalendar()`, `renderDayHint(iso)`.

Doc detail: `docs/P11-CALENDAR-CONFLICT.md` · Exit: `docs/PHASE_11_CLOSEOUT.md`
