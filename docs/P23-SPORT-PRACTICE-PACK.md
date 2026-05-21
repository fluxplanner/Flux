# P23.1 — Sport practice pack

**Step ID:** `P23-SPORT-PRACTICE-PACK`  
**Flag:** `enable_sport_practice_pack` (default **off**)  
**Backlog #102**

Drills, hydration, and recovery task templates for student athletes.

## Packs

| Pack | Tasks |
|------|-------|
| Practice day | Warmup, drills, hydration, cooldown |
| Game / match day | Pre-game meal, equipment, match, recovery |
| Recovery week | Rest, mobility, sleep target, hydration reset |

Also adds **weekly practice** to `flux_weekly_events` (configurable days + time).

## Integration

When both `enable_sport_practice_pack` and `enable_task_template_marketplace` are on, sport packs appear in the Templates marketplace modal too.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_sport_practice_pack: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

**Extracurriculars** tab → Sport practice planner card (below My Activities).

## Rollback

Disable flag — card hidden; applied tasks and weekly rules remain.

Migration: `20260532100000_sport_practice_pack.sql`
