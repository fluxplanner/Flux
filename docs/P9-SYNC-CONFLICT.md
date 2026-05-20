# P9.3 — Sync conflict UI

**Flags:** `enable_offline_sync` (merge + conflicts) · `enable_sync_conflict_ui` (enhanced resolver, default **off**)

Builds on P7 offline sync (`docs/P7-OFFLINE.md`). When both flags are on, students get side-by-side previews, bulk actions, and a Settings entry.

## Behavior

| Feature | Details |
|---------|---------|
| Preview | Task name/date/done/priority; note title + snippet; event title/date/time |
| Timestamps | Relative “edited … ago” per side (uses `fmtFluxDate` for dates when locale flag on) |
| Bulk | **Keep all mine** / **Keep all cloud** in modal header |
| Entry points | Top-bar conflict pill, connectivity banner **Resolve**, Settings → Data & info |
| Rollback | Disable `enable_sync_conflict_ui` → legacy two-button row modal (offline sync unchanged) |

Requires `enable_offline_sync` for conflicts to occur.

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_offline_sync: true,
  enable_sync_conflict_ui: true,
};
await FluxFeatureFlags.load({ force: true });
FluxOfflineSync.install();
```

Simulate: two browsers, same account, edit the same task id while offline sync is on, then sync both.

## Modules

| File | Role |
|------|------|
| `public/js/flux-offline-sync.js` | v2 modal, settings card, bulk resolve |
| `public/css/flux-offline-sync.css` | Preview grid + bulk bar |
| `supabase/migrations/20260528800000_sync_conflict_ui.sql` | Flag |

Migration: `20260525420000_offline_sync.sql` (conflict log unchanged).
