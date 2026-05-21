# P14.4 — Travel time between events

**Step ID:** `P14-TRAVEL-TIME`  
**Flag:** `enable_travel_time` (default **off**)  
**Backlog #62**

Warns when consecutive timed events on the same day leave less gap than your configured travel minutes.

## Event sources

Same as event buffer: Google Calendar busy blocks, `flux_events`, weekly rules. Reuses `FluxEventBuffer.rawBlocksForDate` when available.

## Behavior

| Surface | Detail |
|---------|--------|
| Calendar card | Minimum travel minutes (default 15) |
| Day panel | Lists tight gaps between consecutive events |
| Dashboard | `#travelTimeBanner` |
| Month grid | Dashed outline on days with tight gaps |
| ⌘K | “Travel time settings” → Calendar |

Gap rule: for sorted events A then B, if `B.start − A.end < travelMin` (and non-overlapping), flag it.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_travel_time: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Add two timed events with a short gap → Calendar day panel + banner show travel warning.

## Rollback

Disable flag — card, hints, and banner hidden.

Migration: `20260530800000_travel_time.sql`
