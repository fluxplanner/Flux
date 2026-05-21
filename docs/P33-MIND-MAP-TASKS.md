# P33.1 — Mind map ↔ tasks

**Step ID:** `P33-MIND-MAP-TASKS`  
**Flag:** `enable_mind_map_tasks` (default **off**)  
**Backlog #51**

Radial **mind map** on the dashboard with branches linked bidirectionally to planner tasks.

## Flow

1. **Dashboard** → banner → **Open mind map**
2. Center node = focus topic; **+ Branch** adds child ideas
3. **Create task** from a node → adds to task list and links
4. **Link existing task** via dropdown
5. **Go to task** scrolls dashboard and highlights the task row
6. Completing a task updates the node (✓) when the map reopens

## Storage

`flux_mind_map_v1` — map nodes `{ id, label, parentId, taskId }` synced via cloud slice `mindMapTasks`.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_mind_map_tasks: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — banner and map modal hidden; map data retained locally/cloud.

Migration: `20260533100000_mind_map_tasks.sql`
