# P12.4 — Google Calendar busy overlays

**Step ID:** `P12-GCAL-BUSY`  
**Flags:** `enable_gcal_2way` + `enable_gcal_busy_overlay` (both required; overlay default **off**)  
**Backlog #2**

Shows Google Calendar busy time on the Flux month grid and surfaces conflicts with due tasks.

## Behavior

| Surface | Behavior |
|---------|----------|
| Sync | After two-way sync, events cached in `flux_gcal_busy_cache_v1` |
| Month grid | Blue bottom stripe + up to 2 busy bars per day (`cal-day--gcal-busy`) |
| Day panel | Google Calendar block list + overlap warnings |
| Dashboard | `#gcalBusyBanner` when tasks overlap GCal or heavy same-day load |

Conflict rules:

- 2+ timed GCal events on a day with open due tasks
- Timed task overlaps a GCal block (same day + time window)
- All-day GCal + 3+ due tasks

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = {
  enable_gcal_2way: true,
  enable_gcal_busy_overlay: true,
};
await FluxFeatureFlags.load({ force: true });
FluxGCal2Way.install();
FluxGCalBusy.install();
nav('calendar');
syncGoogleCalendar(); // signed in with Google
```

## Rollback

Disable `enable_gcal_busy_overlay` — grid/banner revert; two-way sync unchanged.

Migration: `20260529400000_gcal_busy_overlay.sql`

See also: `docs/P6-GCAL-2WAY.md`
