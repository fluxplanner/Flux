# P2-GHOST-DRAFT-V2

**Step ID:** `P2-GHOST-DRAFT-V2`  
**Flag:** `enable_ghost_draft_v2` (default **off**)

## Behavior

| Area | v2 (flag on) | Legacy (flag off) |
|------|----------------|-------------------|
| Trigger | New task with subject, Canvas import | Same (`injectGhostDraft`) |
| Rubric | `task.ghostRubric`, `task.rubric`, or `Rubric:` block in notes | — |
| AI output | Rubric checklist + starting points | Generic bullets |
| UI | Card scaffold, loading state, regenerate, paste rubric | Plain ghost block if `ghostDraft` set |

## Rubric sources (priority)

1. `task.ghostRubric` (paste modal)
2. `task.rubric` (future Canvas/sync)
3. Notes section after a line `Rubric:`

Example notes:

```
Rubric:
- Thesis (20 pts): Clear claim
- Evidence (30 pts): Cited sources
```

## Modules

| File | Role |
|------|------|
| `public/js/flux-ghost-draft-v2.js` | Inject, card HTML, rubric modal |
| `public/css/flux-ghost-draft-v2.css` | Scaffold + modal styles |
| `supabase/migrations/20260525150000_enable_ghost_draft_v2_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_ghost_draft_v2: true };
await FluxFeatureFlags.load({ force: true });
FluxGhostDraftV2.install();
// Add a project/essay task with a subject — scaffold appears on card
```

## Rollback

Set flag false; legacy `injectGhostDraft` runs. Existing `task.ghostDraft` strings remain on tasks.
