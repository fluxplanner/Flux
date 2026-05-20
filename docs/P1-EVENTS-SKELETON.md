# P1-EVENTS-SKELETON

**Step ID:** `P1-EVENTS-SKELETON`  
**Flag:** `enable_event_bus` (default **off**)

## What shipped

| Piece | Location |
|-------|----------|
| Table | `public.flux_product_events` (append-only; **not** calendar `localStorage.flux_events`) |
| Batch RPC | `flux_record_product_events(p_events jsonb)` — max 25 rows |
| Client | `public/js/flux-event-bus.js` — patches `FluxBus.emit`, adds `FluxBus.record` / `FluxBus.flushEvents` |
| RLS | Insert/select own; admin read-all |

## Canonical bus events (persist allowlist)

| Event | When emitted |
|-------|----------------|
| `task_completed` | Task marked done |
| `session_ended` | Pomodoro / focus session ends |
| `momentum_update` | Momentum score changes |
| `school_joined` | *(reserved)* school registry join |
| `class_joined` | *(reserved)* student class join RPC success |
| `sign_in` | Event bus installed while flag on |

Canonical names + payload rules: **`docs/TELEMETRY_SCHEMA.md`** and **`FluxTelemetry`** (`P1-TELEMETRY` done).

## Enable for testing

```javascript
window.FLUX_EXPERIMENTS = { enable_event_bus: true };
// re-sign-in or: await FluxFeatureFlags.load({ force: true }); FluxEventBus.install();
```

Verify rows:

```sql
SELECT event_name, created_at FROM flux_product_events
WHERE user_id = auth.uid()
ORDER BY created_at DESC LIMIT 20;
```

## Processors (P7-EVENT-BUS)

Server queue + client drain: **`docs/P7-EVENT-BUS.md`** (`enable_event_bus_processors`).

Still out of scope:

- Cross-user analytics dashboards
- Real-time DB triggers on insert

## Rollback

1. Set `enable_event_bus` false (default).  
2. Client stops enqueueing; table remains for audit.  
3. Drop table only via new migration if legally required.
