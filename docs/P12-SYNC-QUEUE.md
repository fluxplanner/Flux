# P12.2 — Offline sync queue UI

**Step ID:** `P12-SYNC-QUEUE`  
**Flags:** `enable_offline_sync` + `enable_sync_queue_ui` (queue default **off**)  
**Backlog #7**

Visual queue for pending cloud writes when offline sync is on.

## UI

| Surface | Behavior |
|---------|----------|
| Outbox pill | Click opens queue modal (when queue flag on) |
| Settings → Data | “View pending queue” + pending count |
| Modal | Per storage key (tasks, notes, events…), relative time, status |

Statuses: **Pending upload** · **Waiting for network** · **Retry needed**

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = {
  enable_offline_sync: true,
  enable_sync_queue_ui: true,
};
await FluxFeatureFlags.load({ force: true });
FluxOfflineSync.install();
// go offline or fail sync to populate outbox
```

## Rollback

Disable `enable_sync_queue_ui` — pill is count-only (no modal); settings button hidden.

Requires `enable_offline_sync`. Migration: `20260529200000_phase_12_deep_links_sync_queue.sql`
