# Phase 14 closeout — Mood, capture & wellness depth

**Status:** Complete (2026-05-20)

## Shipped steps

| Step | ID | Summary |
|------|-----|---------|
| 14.1 | `P14-MOOD-VELOCITY` | Mood + energy quick-log, completion velocity chart, privacy toggle |
| 14.2 | `P14-SCREENSHOT-SNIP` | Clipboard screenshot → OCR → quick-add task |
| 14.3 | `P14-EVENT-BUFFER` | Buffer padding before/after imported calendar events |
| 14.4 | `P14-TRAVEL-TIME` | Travel time warnings between consecutive events |
| 14.5 | `P14-AMBIENT-WEATHER` | Dashboard weather, sunset, outdoor study hint |

## Flags & migrations

| Flag | Migration |
|------|-----------|
| `enable_mood_velocity` | `20260530500000_mood_velocity.sql` |
| `enable_screenshot_snip` | `20260530600000_screenshot_snip.sql` |
| `enable_event_buffer` | `20260530700000_event_buffer.sql` |
| `enable_travel_time` | `20260530800000_travel_time.sql` |
| `enable_ambient_weather` | `20260530900000_ambient_weather.sql` |

## Docs & QA

- `docs/P14-*.md` (5 step docs)
- `docs/QA_MATRIX.md` §10a–10f

## Rollback

Disable each flag independently — UI slices hide; core mood tab, quick-add, calendar, and dashboard unchanged.

## Suggested next (Phase 15+)

See `docs/ROADMAP.md` Phase 15. Shipped: P15.1 energy scheduling. Next candidates: geofence reminders (#63), sick/lazy day adaptive plan (#59).
