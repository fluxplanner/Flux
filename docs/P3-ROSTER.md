# P3-ROSTER

**Step ID:** `P3-ROSTER`  
**Flag:** `enable_teacher_roster_v2` (default **off**)

## Behavior

### Teacher (class drill-down → Students tab)

- Class-scoped roster (filters `teacher_students` by `class_code` + owning teacher)
- Copy class code control
- Inline **pending join requests** for that class with Approve / Reject
- Enrollment stats (enrolled + pending counts)
- Class cards on dashboard show `N enrolled · M pending` when counts are known

### Student (School panel)

When the flag is **on**, join-by-code sends a **pending** `class_join_requests` row (teacher must approve). Legacy instant enroll via `flux_join_teacher_class` RPC remains when the flag is **off**.

## Modules

| File | Role |
|------|------|
| `public/js/flux-teacher-roster-v2.js` | Roster UI, pending queue, student join request path |
| `public/css/flux-teacher-roster-v2.css` | Roster tab + join button styles |
| `supabase/migrations/20260525210000_enable_teacher_roster_v2_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_teacher_roster_v2: true };
await FluxFeatureFlags.load({ force: true });
// Teacher: open a class → Students tab
// Student: School → Join a Teacher Class (request approval)
```

## Rollback

Disable flag; students use instant RPC join; class Students tab uses legacy inline HTML.
