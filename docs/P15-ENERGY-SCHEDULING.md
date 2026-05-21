# P15.1 — Energy-based scheduling

**Step ID:** `P15-ENERGY-SCHEDULING`  
**Flag:** `enable_energy_scheduling` (default **off**)  
**Backlog #60**

Learns peak energy hours from dashboard energy slider check-ins and suggests scheduling heavy tasks in those windows. Read-only hints — no auto-reschedule.

## Behavior

| Feature | Detail |
|---------|--------|
| Sampling | Records hour + level each time `setEnergy()` runs |
| Peak windows | Top hourly averages grouped into ranges (e.g. 9AM–11AM) |
| Heavy tasks | Essays, projects, labs, difficulty ≥ 4 |
| Dashboard card | Peak chips + “Schedule during peak” task list |
| ⌘K | “Peak energy hours” → Dashboard |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_energy_scheduling: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Adjust energy slider a few times at different hours → card shows peak windows.

## Rollback

Disable flag — card hidden; existing energy sort unchanged.

Migration: `20260531000000_energy_scheduling.sql`
