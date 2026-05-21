# P13.5 — Habit chain heatmaps

**Step ID:** `P13-HABIT-HEATMAP`  
**Flag:** `enable_habit_heatmap` (default **off**)  
**Backlog #11**

“Don’t break the chain” GitHub-style heatmaps on the Focus Timer tab, separate from one-off tasks.

## UI (Focus Timer)

- Card below **Weekly Focus Heatmap**
- Add habits, check off today, 12-week completion grid per habit
- Current + best streak display
- Data in existing `flux_habits` sync key (`history[]` ISO dates)

## Habit shape

```json
{
  "id": 1,
  "name": "Read 20 min",
  "icon": "🔥",
  "history": ["2026-05-18", "2026-05-19"],
  "streak": 2,
  "bestStreak": 5
}
```

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_habit_heatmap: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Focus Timer → add habit → check today → heatmap cell fills.

## Rollback

Disable flag — card hidden; habit data remains in local/cloud storage.

Migration: `20260530200000_habit_heatmap.sql`
