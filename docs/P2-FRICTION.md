# P2-FRICTION

**Step ID:** `P2-FRICTION`  
**Flag:** `enable_task_friction` (default **off**)

## Tiers

| Tier | Typical signals |
|------|-----------------|
| `warning` | 1+ reschedule, or score ≥ 10 |
| `aged` | 3+ reschedules, multi-day overdue, or score ≥ 32 |
| `severe` | 5+ reschedules or score ≥ 55 |

Score blends: `rescheduled×14`, `overdueDays×10`, stale open days.

Uses `FluxBehavior.frictionTier` as a floor when the kit module is loaded.

## UI

- Task cards: existing `friction-*` classes + **`flux-friction-badge`** label
- `data-friction-tier` / `data-friction-score` on card for debugging
- Date change (edit modal or inline picker) increments `rescheduled` when flag on
- **Aged/severe** + unhandled → `breakItDown` intervention (same as legacy 3× rule)

## Enable

```javascript
window.FLUX_EXPERIMENTS = { enable_task_friction: true };
await FluxFeatureFlags.load({ force: true });
```

Reschedule a task due date twice — badge should escalate.

## Rollback

Disable flag; cards use legacy reschedule-only tier logic.
