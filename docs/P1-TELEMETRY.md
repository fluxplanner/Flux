# P1-TELEMETRY

**Step ID:** `P1-TELEMETRY`  
**Depends on:** `P1-EVENTS-SKELETON`

## Delivered

| Artifact | Path |
|----------|------|
| Human schema | `docs/TELEMETRY_SCHEMA.md` |
| Client catalog + normalizers | `public/js/flux-telemetry.js` |
| Event bus integration | `public/js/flux-event-bus.js` uses `FluxTelemetry.normalize()` |
| New event | `role_mode_changed` on `FluxRole.setMode` |

## Dev tools

```javascript
FluxTelemetry.audit();
FluxTelemetry.normalize('task_completed', { id: 1, name: 'Secret homework', subject: 'Math' });
// → { event_name, payload: { task_id: 1, subject: 'Math', ... } }  // name stripped
```

## Production

Keep `enable_event_bus` **false** until legal/product approves server-side retention. Schema is safe to ship dark.

## Next

Phase 2 features add events via the same catalog process; processors remain `P7-EVENT-BUS`.
