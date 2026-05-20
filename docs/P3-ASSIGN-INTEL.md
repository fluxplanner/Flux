# P3-ASSIGN-INTEL

**Step ID:** `P3-ASSIGN-INTEL`  
**Flag:** `enable_teacher_assign_intel` (default **off**)

## Behavior

When enabled, teachers see **design-time** assignment intelligence in the class drill-down (`openTeacherClassView`):

| Feature | Description |
|---------|-------------|
| Friction badge | Predicted student load 0–100 with tier (light → high friction) |
| Scaffold steps | Type-aware decomposition (essay, lab, quiz, default) |
| Steps modal | Read-only list; does **not** auto-create student tasks |

On **create assignment**, friction + scaffold JSON are written to `teacher_assignments` (`friction_score`, `friction_tier`, `scaffold_steps`, `intel_computed_at`).

Heuristic inputs: type, estimated minutes, priority, points, description length, due-date proximity. Four+ scaffold steps slightly reduce friction score.

## Modules

| File | Role |
|------|------|
| `public/js/flux-teacher-assign-intel.js` | Analyze, UI badges, modal, persist |
| `public/css/flux-teacher-assign-intel.css` | Badge + modal styles |
| `supabase/migrations/20260525200000_teacher_assign_intel.sql` | Columns + flag seed |

## Enable (dev)

Teacher account with a class:

```javascript
window.FLUX_EXPERIMENTS = { enable_teacher_assign_intel: true };
await FluxFeatureFlags.load({ force: true });
// Open a class → Assignments tab; post a new assignment to persist intel columns
```

## Rollback

Disable flag; assignment rows and inserts omit intel fields (legacy UI).
