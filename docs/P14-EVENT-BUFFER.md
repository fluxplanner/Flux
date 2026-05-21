# P14.3 — Event buffer time

**Step ID:** `P14-EVENT-BUFFER`  
**Flag:** `enable_event_buffer` (default **off**)  
**Backlog #61**

Configurable padding before and after imported calendar events. Warns when timed tasks land in buffer zones (not inside the event itself).

## Sources

| Source | Included |
|--------|----------|
| Google Calendar busy cache | Timed blocks (when `enable_gcal_busy_overlay` synced) |
| `flux_events` | One-off events with time |
| Weekly rules | Repeating activities with time |

## Behavior

| Surface | Detail |
|---------|--------|
| Calendar card | Before/after minutes (default 15) |
| Day panel | Buffer zone list + conflict bullets |
| Dashboard | `#eventBufferBanner` when tasks overlap buffers |
| Month grid | Gold ring on days with buffer conflicts |
| ⌘K | “Event buffer settings” → Calendar |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_event_buffer: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Calendar → **Event buffer time** → set minutes → add a timed task in the buffer window.

## Rollback

Disable flag — no buffer card, hints, or banner.

Migration: `20260530700000_event_buffer.sql`
