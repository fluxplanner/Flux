# P22.1 — ICS timetable import

**Step ID:** `P22-ICS-TIMETABLE-IMPORT`  
**Flag:** `enable_ics_timetable_import` (default **off**)  
**Backlog #6**

Import school timetables and blackout dates from `.ics` files in one step.

## Flow

1. **Calendar** tab → ICS import card (below iCal subscribe)
2. Drop or browse for `.ics`
3. Preview classified items: **Weekly**, **Event**, **Blackout**
4. Toggle import options (weekly schedule / blackout rest days)
5. **Import selected** → writes to `flux_weekly_events`, `flux_events`, `flux_rest_days_v1`

## Classification

| ICS pattern | Flux target |
|-------------|-------------|
| `RRULE:FREQ=WEEKLY;BYDAY=…` | Weekly repeating activity |
| Single timed/date event | One-off calendar event |
| All-day + holiday keywords | Rest/blackout day |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_ics_timetable_import: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Calendar → drop a school `.ics` → review → Import selected.

## Rollback

Disable flag — card hidden; imported rows remain (tagged `_icsImport` in local data).

Migration: `20260532000000_ics_timetable_import.sql`
