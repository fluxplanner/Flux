# P2-NEURO-DASHBOARD

**Step ID:** `P2-NEURO-DASHBOARD`  
**Flag:** `enable_neuro_dashboard` (default **off**)

## Modes

Combines **cognitive load** (v2 or legacy) with **momentum** (v2 or session streak) to pick a dashboard layout.

| Mode | Typical trigger | Dashboard UX |
|------|-----------------|--------------|
| **recovery** | Load ≥ 85% / overload | Hide pulse, schedule, countdown, gap-fill, weekly banner; show recovery banner |
| **focus** | Load 60–84% / elevated | Dim/hide secondary sections; tighter cards |
| **flow** | Momentum composite ≥ 52 or flow/fire zone | Expanded gaps; workspace glow |
| **balanced** | Default | Standard layout |

Body attributes: `data-neuro-dash="on"`, `data-neuro-dash-mode`, `data-neuro-dash-density`.

Mode chip appears in the dashboard work header (e.g. `🎯 Focus`).

## Modules

| File | Role |
|------|------|
| `public/js/flux-neuro-dashboard.js` | Compute mode, apply tokens, bus hooks |
| `public/css/flux-neuro-dashboard.css` | Section visibility + density |
| `supabase/migrations/20260525160000_enable_neuro_dashboard_flag.sql` | Flag seed |

Works alongside `enable_cognitive_ui` / `enable_momentum_v2` — reads their state when those flags are on.

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_neuro_dashboard: true, enable_cognitive_ui: true };
await FluxFeatureFlags.load({ force: true });
FluxNeuroDashboard.install();
```

## Rollback

Disable flag; `FluxNeuroDashboard.clear()` removes body/dashboard attributes and hides the chip.
