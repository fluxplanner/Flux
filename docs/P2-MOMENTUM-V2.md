# P2-MOMENTUM-V2

**Step ID:** `P2-MOMENTUM-V2`  
**Flag:** `enable_momentum_v2` (default **off**)

## Domains (0–100 each)

| Domain | Signals |
|--------|---------|
| **task** | Session streak (`_momentum`) + tasks completed today |
| **academic** | Focus sessions today + subject/class completions |
| **emotional** | Latest mood check-in (mood + stress) |
| **recovery** | Inverse cognitive load, rest day, sleep |

**Composite** = weighted blend (35% / 25% / 20% / 20%) → drives `data-zone` and topbar pill.

## Modules

| File | Role |
|------|------|
| `public/js/flux-momentum-v2.js` | Compute, persist `flux_momentum_v2_v1`, render pill |
| `public/css/flux-momentum-v2.css` | Domain bar styles |
| `public/js/core/behavior-engine.js` | Legacy `momentumState(multiplier)` — unchanged |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_momentum_v2: true };
await FluxFeatureFlags.load({ force: true });
FluxMomentumV2.install();
// complete tasks / mood / focus — pill shows composite + 4 bars
```

## Legacy behavior

With flag **off**: `addMomentum()`, `_momentum`, achievements (`streak_3` / `streak_7`), and `momentum_update` telemetry count unchanged.

## Rollback

Set flag false; optional `save('flux_momentum_v2_v1', null)`.
