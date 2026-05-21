# Phase 11 closeout — Schedule intelligence

**Status:** Complete (2026-05-20)

## Shipped steps

| Step | ID | Summary |
|------|-----|---------|
| 11.1 | `P11-SYLLABUS-CONFLICT` | Dashboard conflict banner (exam stack, heavy day, subject clash, duplicate due) |
| 11.2 | `P11-PILOT-B` | IA East school flag override + banner refresh on `renderTasks()` |
| 11.3 | `P11-CALENDAR-CONFLICT` | Calendar `cal-day--conflict` markers + day-panel hints |

## Flags & migrations

- **Flag:** `enable_syllabus_conflict_check` (default off; on for IAE students via school override)
- **Migrations:** `20260529000000_syllabus_conflict_check.sql`, `20260529100000_ia_east_syllabus_conflict.sql`

## Docs & QA

- `docs/P11-SYLLABUS-CONFLICT.md`, `docs/P11-CALENDAR-CONFLICT.md`
- `docs/QA_MATRIX.md` §0m

## Rollback

Turn flag off globally or remove school override — banner reverts to legacy heavy-day line; calendar markers hidden.

## Suggested next (Phase 12+)

See `docs/PHASE_12_BACKLOG.md` and `docs/ROADMAP.md` Phase 12. Shipped: P12.1 deep links, P12.2 sync queue UI. Next candidates: voice capture (12.3), GCal busy overlays (12.4).
