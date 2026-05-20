# P3-RECOVERY

**Step ID:** `P3-RECOVERY`  
**Flag:** `enable_assignment_recovery` (default **off**)

## Behavior

Structured **catch-up plans** for students who are missing or late on teacher assignments.

| Step | Actor | Action |
|------|--------|--------|
| 1 | Teacher | **Propose** plan per student (from class → assignment → Recovery) |
| 2 | Teacher | **Approve** or **reject** from dashboard Recovery queue |
| 3 | Student | Sees **approved** steps appended to task notes after `loadTeacherAssignments` |

Plans use scaffold steps from `FluxTeacherAssignIntel` when available, otherwise a default 3-step template.

Statuses: `proposed` → `approved` | `rejected` | `completed` (student update policy allows `completed` later).

Students are notified via existing messaging when a plan is approved or rejected.

## Schema

`assignment_recovery_plans` — see `supabase/migrations/20260525240000_assignment_recovery_plans.sql`

## Modules

| File | Role |
|------|------|
| `public/js/flux-assignment-recovery.js` | Propose, approve, student attach |
| `public/css/flux-assignment-recovery.css` | Banner + modal styles |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_assignment_recovery: true };
await FluxFeatureFlags.load({ force: true });
renderTeacherDashboard();
```

Apply migration on Supabase before testing inserts.

## Rollback

Disable flag; no recovery UI; students keep existing tasks without recovery notes.
