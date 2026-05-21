# P17.1 — Task template marketplace

**Step ID:** `P17-TASK-TEMPLATE-MARKETPLACE`  
**Flag:** `enable_task_template_marketplace` (default **off**)  
**Backlog #56**

Replaces the legacy **Templates** modal with curated multi-task packs and JSON import when the flag is on.

## Curated packs

| Pack | Tasks |
|------|-------|
| AP exam crunch | Register, unit review, FRQ practice, light review |
| SAT weekend prep | Full test, missed-Q review, vocab drill |
| College application season | Essay brainstorm, rec letter, portal scan, scholarships |
| Exam week | 3-task starter (legacy pack) |
| Project milestones | 3-task starter (legacy pack) |

Also includes quick single-task templates (Homework, Study, etc.).

## Import / export

Import `flux-task-pack-*.json`:

```json
{
  "v": 1,
  "name": "My pack",
  "icon": "📦",
  "tasks": [{ "name": "Read ch. 3", "type": "reading", "estTime": 30 }]
}
```

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_task_template_marketplace: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Dashboard **Templates** button → marketplace modal → apply a pack.

## Rollback

Disable flag → legacy template menu (8 singles + 2 packs).

Migration: `20260531500000_task_template_marketplace.sql`
