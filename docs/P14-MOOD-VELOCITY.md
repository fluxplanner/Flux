# P14.1 — Mood + completion velocity

**Step ID:** `P14-MOOD-VELOCITY`  
**Flag:** `enable_mood_velocity` (default **off**)  
**Backlog #12**

Quick-log mood and energy, see how task completion velocity correlates over 14 days, and keep logs private from counselor snapshots when desired.

## Behavior

| Feature | Detail |
|---------|--------|
| Quick log | Mood + energy chips on Mood tab — one tap save |
| Velocity chart | 14-day bars = tasks completed; dot = mood; ring = energy |
| Insight | Plain-language correlation hint after enough data |
| Privacy | Default **on** — skips counselor wellness snapshots + omits quick logs from cloud slice |
| ⌘K | “Mood velocity check-in” → Mood tab |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_mood_velocity: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Mood tab → **Mood & velocity** card → pick mood + energy → Save.

## Rollback

Disable flag — card hidden; existing mood tab unchanged.

Migration: `20260530500000_mood_velocity.sql`
