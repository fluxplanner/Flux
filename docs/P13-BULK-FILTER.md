# P13.3 — Bulk edit by filter

**Step ID:** `P13-BULK-FILTER`  
**Flag:** `enable_bulk_filter` (default **off**)  
**Backlog #55**

Bulk-select and edit every task in the active dashboard filter or smart list.

## Behavior

| Action | Detail |
|--------|--------|
| **Bulk edit filter** | Button on filter row — enters bulk mode + selects all visible tasks |
| **Select filtered** | Replaces “Select all” in bulk bar (toggle visible set only) |
| **Set priority** | high / med / low on selection |
| **Set estimate** | Minutes on selection |
| **Filter hint** | Bulk bar shows list name + visible count |
| **⌘K** | “Bulk edit filtered tasks” |

Works with standard chips (Overdue, Today, …) and smart lists when `enable_smart_lists` is on.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = {
  enable_bulk_filter: true,
  enable_smart_lists: true,
};
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Apply a smart list → **Bulk edit filter** → reschedule or set estimate on all matches.

## Rollback

Disable flag — legacy “Select all” uses every open task.

Migration: `20260530000000_bulk_filter.sql`
