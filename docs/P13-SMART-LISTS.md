# P13.2 — Smart task lists

**Step ID:** `P13-SMART-LISTS`  
**Flag:** `enable_smart_lists` (default **off**)  
**Backlog #54**

Preset one-click task filters on the dashboard with counts and ⌘K shortcuts.

## Presets

| ID | Label | Rule |
|----|-------|------|
| `overdue_stem` | Overdue STEM | Open + overdue + STEM subject |
| `no_estimate` | No estimate | Open + `estTime` missing or 0 |
| `exam_prep` | Exam prep | Open test/quiz due within 14 days (or undated) |
| `due_week` | Due this week | Open tasks due in next 7 days (pin via store) |

Default pinned: overdue STEM, no estimate, exam prep.

## UI

- Chip row under standard filters on dashboard
- Count badge per list
- **Smart lists** commands in ⌘K palette (when `enable_cmd_palette_v2` optional)

## Data

- `flux_smart_lists_v1` → `smartLists` in cloud sync (`pinned`, `lastActive`)

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_smart_lists: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — standard filter chips only; `taskFilter` smart values ignored.

Migration: `20260529900000_smart_lists.sql`
