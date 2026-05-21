# P16.2 — Syllabus week auto-scaffold

**Step ID:** `P16-SYLLABUS-WEEK-SCAFFOLD`  
**Flag:** `enable_syllabus_week_scaffold` (default **off**)  
**Backlog #57**

Scans task names and notes for syllabus week references (`Week 5`, `Wk 3`, `W12`) and offers one-click placeholder tasks for each week.

## Behavior

| Input | Use |
|-------|-----|
| Week regex in name/notes | Builds detected-week list with mention counts |
| Term start (Week 1 Monday) | Maps week N → dates (Mon–Sun block) |
| Default subject | Applied to scaffolded placeholders |
| Scaffold | Adds 4 open tasks: preview, homework, review, catch-up |

Tasks are tagged with `syllabusWeek` so re-scaffold is skipped.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_syllabus_week_scaffold: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Add a task named `Week 4 reading` → dashboard **Syllabus weeks** card lists Week 4 → **Scaffold week 4**.

## Rollback

Disable flag — card hidden; scaffolded tasks remain normal tasks.

Migration: `20260531400000_syllabus_week_scaffold.sql`
