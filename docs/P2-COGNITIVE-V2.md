# P2-COGNITIVE-V2

**Step ID:** `P2-COGNITIVE-V2`  
**Flag:** `enable_cognitive_ui` (default **off**)

## Levels (UI tokens)

| Level | Score | Body attributes | UX |
|-------|-------|-----------------|-----|
| **calm** | 0–39 | `data-cognitive-level=calm` | Full dashboard |
| **balanced** | 40–59 | `balanced` | Default |
| **elevated** | 60–84 | `elevated` + `flux-cog-density-compact` | Slightly reduced secondary sections |
| **overload** | 85–100 | `overload` + recovery + `flux-cog-density-minimal` | Recovery banner + hidden non-essential tasks (existing CSS) |

## Signals

- Base: `FluxBehavior.calcCognitiveLoad()` (same as legacy)
- V2 boosts: high stress (+5–10), low sleep (+8), good sleep (−4)

CSS variables: `--flux-cog-accent`, `--flux-cog-glow`, `--flux-cog-score`.

## Modules

| File | Role |
|------|------|
| `public/js/flux-cognitive-v2.js` | Compute, tokens, topbar meter |
| `public/css/flux-cognitive-v2.css` | Meter + density modes |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_cognitive_ui: true };
await FluxFeatureFlags.load({ force: true });
FluxCognitiveV2.install();
```

## Legacy

Flag **off**: `updateCognitiveLoadMeter()` behavior unchanged (score-only + `data-recovery`).

## Rollback

Disable flag; `FluxCognitiveV2.clearTokens()` on sign-out optional.
