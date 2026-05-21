# P16.1 — Exam prep daily minutes

**Step ID:** `P16-EXAM-PREP-PLAN`  
**Flag:** `enable_exam_prep_plan` (default **off**)  
**Backlog #58**

Extends the dashboard exam countdown with suggested **minutes per day** for each upcoming test/quiz.

## Algorithm

| Input | Use |
|-------|-----|
| Exam task | `estTime` or default 90 min review |
| Same-subject open tasks | Due on/before exam — sum `estTime` |
| Days until exam | `ceil(total / days)` min/day (floor 15) |

Shows up to 4 upcoming exams with subject color stripe.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_exam_prep_plan: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Add a **test/quiz** task with a future due date → dashboard **Exam countdown** shows daily prep rows.

## Rollback

Disable flag — countdown card unchanged (no prep block).

Migration: `20260531300000_exam_prep_plan.sql`
