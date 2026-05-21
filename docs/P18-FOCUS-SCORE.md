# P18.1 — Focus score heuristic

**Step ID:** `P18-FOCUS-SCORE`  
**Flag:** `enable_focus_score` (default **off**)  
**Backlog #32**

Scores each pomodoro session from **minutes logged** vs **tab-switch interruptions** (existing visibility pause tracker).

## Formula (heuristic)

| Factor | Weight |
|--------|--------|
| Session length | Up to ~52 pts (caps ~43 min) |
| Interruptions | −16 pts each (tab hidden while timer running) |

Bands: Deep (85+), Solid (70+), Fragmented (50+), Interrupted (&lt;50).

## UI

- **Focus Timer** page: score card above weekly heatmap
- **Session recap** toast: shows score after each pomodoro
- Annotates `sessionLog` entries with `distractions` + `focusScore` (cloud-synced)

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_focus_score: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Complete a pomodoro (switch tabs mid-session to simulate interruptions) → recap + card update.

## Rollback

Disable flag — card hidden; session log fields ignored.

Migration: `20260531600000_focus_score.sql`
