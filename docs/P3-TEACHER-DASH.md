# P3-TEACHER-DASH

**Step ID:** `P3-TEACHER-DASH`  
**Flag:** `enable_teacher_class_momentum` (default **off**)

## Behavior

Adds a **Class momentum** grid to the teacher overview (`renderTeacherDashboard`) with **aggregate metrics only**:

| Metric | Source |
|--------|--------|
| Enrolled | Count of `teacher_students` rows per `class_code` |
| On track % | Completion slots vs enrolled × assignments |
| To review | Submitted completions awaiting grade |
| Momentum score | 0–100 heuristic (completion + recent activity − review backlog) |
| Zone | idle / warm / flow / fire |

**No student names** appear on momentum cards. Existing submission/message lists are unchanged.

Class list cards gain a one-line momentum hint when the flag is on (e.g. `· 72 momentum · 68% on track`).

## Modules

| File | Role |
|------|------|
| `public/js/flux-teacher-dash-v2.js` | Aggregates + momentum section HTML |
| `public/css/flux-teacher-dash-v2.css` | Card grid styles |
| `supabase/migrations/20260525190000_enable_teacher_class_momentum_flag.sql` | Flag seed |

## Enable (dev)

Teacher account + classes with roster/completions:

```javascript
window.FLUX_EXPERIMENTS = { enable_teacher_class_momentum: true };
await FluxFeatureFlags.load({ force: true });
renderTeacherDashboard();
```

## Rollback

Disable flag; dashboard renders without momentum section or class meta hints.
