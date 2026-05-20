# P8-ERRORS

**Step ID:** `P8-ERRORS`  
**Flag:** `enable_client_error_reporting` (default **off**)

Privacy-scrubbed client error capture for production debugging. No stack traces or emails are sent to the server.

## Behavior

| Layer | What happens |
|-------|----------------|
| **Hooks** | `window.error`, `unhandledrejection` |
| **Local ring** | Last 20 entries in `flux_error_ring_v1` (devtools / owner debugging) |
| **Server** | `client_error` event via `FluxEventBus.record` only when **`enable_event_bus`** is also on (max 5/min) |

## Payload (server)

| Field | Notes |
|-------|--------|
| `kind` | `error` \| `unhandledrejection` |
| `message` | Scrubbed, max 240 chars (emails/tokens redacted) |
| `source` | File basename only |
| `line` / `col` | Optional numbers |

## Modules

| File | Role |
|------|------|
| `public/js/flux-error-reporter.js` | Capture + ring + rate-limited persist |
| `public/js/flux-telemetry.js` | `client_error` catalog entry |
| `supabase/migrations/20260525470000_client_error_reporting.sql` | Feature flag |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_client_error_reporting: true,
  enable_event_bus: true,
};
await FluxFeatureFlags.load({ force: true });
FluxEventBus.install();
FluxErrorReporter.install();
throw new Error('E2E test error');
// FluxErrorReporter.ring() in console
```

## Rollback

Disable `enable_client_error_reporting`; hooks not installed. Ring data is harmless local JSON.
