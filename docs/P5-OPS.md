# P5-OPS

**Step ID:** `P5-OPS`  
**Flag:** `enable_school_ops` (default **off**)

## Behavior

**Operations intelligence** — school-wide **overload week prediction** from aggregate signals (no student-level rows):

| Signal | Source |
|--------|--------|
| 7-day assignment load | Visible `teacher_assignments` due dates (count + estimated minutes per day) |
| Week level | `ok` / `elevated` / `high` vs heuristic capacity (`active_classes × 7 × 90` min floor) |
| Peak day | Day with highest estimated minutes in the window |
| Wellness | Consented `student_wellness_snapshots` (7d): high-load count, snapshot total |
| Grading backlog | Pending `student_completions` (`submitted`) |

**UI surfaces**

- **Operations** tab (`adminOps`) — full panel at top of page
- **School** admin dashboard — compact card (stats hidden; signals + week bars)

Data loads via `flux_school_ops_overload_week()` RPC (admin-only, `SECURITY DEFINER`).

## Modules

| File | Role |
|------|------|
| `public/js/flux-school-ops.js` | RPC load, signals, week bar chart |
| `public/css/flux-school-ops.css` | Panel styling |
| `supabase/migrations/20260525340000_school_ops_overload.sql` | RPC + flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_school_ops: true };
await FluxFeatureFlags.load({ force: true });
renderAdminDashboard();
// or nav to Operations:
renderAdminOps();
```

Sign in as **admin** → School tab and/or Operations tab.

## Rollback

Disable flag; ops panels hidden. RPC remains but unused.
