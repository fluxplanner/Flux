# P2-PREDICT

**Step ID:** `P2-PREDICT`  
**Flag:** `enable_predict_v2` (default **off**)

## Insights (read-only)

| Insight | Source | User action |
|---------|--------|-------------|
| **Deadline risk** | `calcDeadlineRisk` on open tasks | **View** → `openEdit` only |
| **Overload week** | Sum of est. minutes due in next 7 days vs heuristic capacity | Display only |
| **Cognitive line** | `FluxCognitiveV2` when enabled | Display only |
| **Gap-fill** | `fluxComputeFreeSlots` + `FluxBehavior.suggestForGaps` | **View** (not auto-start focus) |

No tasks are created, rescheduled, or started automatically.

## Modules

| File | Role |
|------|------|
| `public/js/flux-predict-v2.js` | Panel + gap-fill renderer |
| `public/css/flux-predict-v2.css` | Card styles |
| `public/js/flux-telemetry.js` | `predict_insight_shown` event |
| `supabase/migrations/20260525180000_enable_predict_v2_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_predict_v2: true, enable_event_bus: true };
await FluxFeatureFlags.load({ force: true });
FluxPredictV2.install();
// Open dashboard with classes + due tasks
```

## Legacy

Flag **off**: `renderPredictiveGapFill` unchanged (gap card with **Start →**).

## Rollback

Disable flag; insights host hidden; legacy gap-fill returns.
