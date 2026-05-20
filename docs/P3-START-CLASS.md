# P3-START-CLASS

**Step ID:** `P3-START-CLASS`  
**Flag:** `enable_live_class_mode` (default **off**, seeded in `20260524120000_feature_flags_foundation.sql`)

## Behavior

Immersive **Start Class** overlay for teachers:

| Feature | Description |
|---------|-------------|
| Full-screen cockpit | Hides nav; class title, schedule, elapsed timer |
| Live stats | Enrolled, assignments due ≤3 days, submissions to review, pending joins |
| Agenda | Up to 6 assignments with completion bars |
| Session notes | Local-only scratchpad (persisted per class session on device) |
| Quick actions | Copy code, new assignment, announce |
| Resume chip | Dashboard banner when a session is active |
| End class | Clears session; legacy UI returns |

Session state: `flux_live_class_session_v1` via `FluxStorage` / `localStorage`.

## Modules

| File | Role |
|------|------|
| `public/js/flux-teacher-live-class.js` | Overlay, timer, session persistence |
| `public/css/flux-teacher-live-class.css` | Immersive layout |

## Entry points

- Class drill-down → **▶ Start Class** (header)
- Teacher dashboard → **Live: …** resume chip (reopens immersive mode)

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_live_class_mode: true };
await FluxFeatureFlags.load({ force: true });
// Open a class → Start Class
```

## Rollback

Disable flag; no Start Class button or resume chip; existing class panel unchanged.
