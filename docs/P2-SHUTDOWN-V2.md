# P2-SHUTDOWN-V2

**Step ID:** `P2-SHUTDOWN-V2`  
**Flag:** `enable_shutdown_v2` (default **off**)

## Behavior

| Area | v2 (flag on) | Legacy (flag off) |
|------|----------------|-------------------|
| Entry | `🌙 Shutdown` on dashboard work header | `dailyShutdown()` only (no default button) |
| Stats | Done, efficiency, focus minutes, carried overdue | Done, efficiency, focus only |
| Reflection | Win, blocker, energy 1–5 | — |
| Tomorrow | Top 5 tasks by priority | — |
| Coach line | After **Finish shutdown** (AI or fallback) | On open (AI only) |
| Log | `flux_shutdown_v2_log_v1` via `FluxStorage` | — |

## Modules

| File | Role |
|------|------|
| `public/js/flux-shutdown-v2.js` | Modal, stats, reflection, log |
| `public/css/flux-shutdown-v2.css` | Overlay + card styles |
| `supabase/migrations/20260525140000_enable_shutdown_v2_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_shutdown_v2: true };
await FluxFeatureFlags.load({ force: true });
FluxShutdownV2.install();
// or: dailyShutdown();
```

## Rollback

Set flag false; legacy inline modal in `app.js` runs again. Optional: clear `flux_shutdown_v2_log_v1`.
