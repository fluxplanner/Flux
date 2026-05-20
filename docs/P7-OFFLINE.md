# P7-OFFLINE

**Step ID:** `P7-OFFLINE`  
**Flag:** `enable_offline_sync` (default **off**)

Offline-first sync layer on top of existing `user_data` push/pull in `app.js`.

## Behavior

| Feature | Details |
|---------|---------|
| Outbox | Queues `tasks` / `notes` / `events` mutations while offline or after sync failure |
| Merge | Per-id **last-write-wins** using `_fluxTs` + device stamp |
| Skew | Edits within 2s merge automatically (same session / clock skew) |
| Conflicts | Divergent edits → local list + **Resolve** UI (Keep mine / Keep cloud) |
| Scope | Tasks, notes, calendar events — other `user_data` keys keep legacy overwrite |

Not full CRDT — pragmatic conflict rules suitable for planner blobs.

## Conflict rules

1. **Tombstone** — `_fluxDeleted: true` drops item on merge when only local has it.
2. **Identical fingerprint** — merge metadata, keep one copy.
3. **Clock skew** — if `|localTs - remoteTs| ≤ 2000ms`, field-merge both snapshots.
4. **LWW** — higher `_fluxTs` wins.
5. **Tie** — keep local + surface conflict for user resolution.

Fingerprints compare stable fields only (task name, date, done, priority, etc.) — no free-text essay bodies in task compare.

## Modules

| File | Role |
|------|------|
| `public/js/flux-offline-sync.js` | Outbox, merge, UI |
| `public/css/flux-offline-sync.css` | Pills + modal |
| `supabase/migrations/20260525420000_offline_sync.sql` | Flag + `flux_sync_conflict_log` audit |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_offline_sync: true };
await FluxFeatureFlags.load({ force: true });
FluxOfflineSync.install();
```

Test: DevTools → Offline → edit a task → Online → Force sync. Simulate conflict by editing same task id on two browsers.

## Rollback

Disable flag; sync reverts to full overwrite for tasks/notes/events.
