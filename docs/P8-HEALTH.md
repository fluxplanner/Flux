# P8-HEALTH — Ops health / readiness

**Step ID:** `P8-HEALTH`  
**Flag:** `enable_ops_health_panel` (default **off**)

Admin/owner widget for post-deploy smoke checks: connectivity, auth, feature flags, staff SQL migrations, RLS snapshot.

## Checks

| Check | Who sees it |
|-------|-------------|
| Supabase API | All (when panel enabled) |
| Auth session | All |
| Feature flags loaded | All |
| Client error ring | All |
| Offline sync outbox | When `enable_offline_sync` on |
| Staff productivity tables | Admin / owner |
| `flux_rls_health_snapshot()` | Admin / owner |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_ops_health_panel: true };
```

Admin → **Operations** → customize workspace → **System health** → **Run checks**.

## Migration

`supabase/migrations/20260528400000_ops_health_panel.sql` — flag seed + extended RLS snapshot tables.

## Rollback

Disable flag; widget hidden. RPC change is backward-compatible (extra tables in policy list only).
