# P5-COMMAND

**Step ID:** `P5-COMMAND`  
**Flag:** `enable_school_command` (default **off**)

## Behavior

**Command center** panel on the admin school dashboard — school-wide **aggregate counts only**:

| Group | Metrics |
|-------|---------|
| Community | Students, teachers, counselors, staff & admin |
| Teaching ops | Active classes, assignments, submissions to review, join requests, recovery proposed |
| Counseling ops | Counselor assignments, basic/wellness consent counts, appointments, wellness check-ins (7d) |
| Admin queue | Pending meeting requests |

Data loads via `flux_school_command_metrics()` RPC (admin-only, `SECURITY DEFINER`).

## Modules

| File | Role |
|------|------|
| `public/js/flux-school-command.js` | RPC load + render command center |
| `public/css/flux-school-command.css` | Panel + metric cards |
| `supabase/migrations/20260525310000_school_command_metrics.sql` | Metrics RPC |

Flag seeded in `20260524120000_feature_flags_foundation.sql` as `enable_school_command`.

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_school_command: true };
await FluxFeatureFlags.load({ force: true });
renderAdminDashboard();
```

Sign in as **admin** → School tab.

## Rollback

Disable flag; command center section hidden. RPC remains available but unused.
