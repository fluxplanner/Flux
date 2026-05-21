# P13.1 — Global search v2

**Step ID:** `P13-GLOBAL-SEARCH-V2`  
**Flag:** `enable_global_search_v2` (default **off**)  
**Backlog #53**

Extends ⌘⇧K global search with fuzzy matching, keyboard navigation, and recent queries.

## Behavior

| Feature | Detail |
|---------|--------|
| Fuzzy | Subsequence + substring scoring on tasks, notes, classes |
| Keyboard | ↑↓ highlight · Enter open · Esc close |
| Recents | Last 8 queries shown when search opens empty |
| Cloud | `globalSearchRecents` in sync payload |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_global_search_v2: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

⌘⇧K → type partial query (`bio hw`) → arrow to result → Enter.

## Rollback

Disable flag — legacy substring search (or Flux100 fuzzy if loaded).

Migration: `20260529800000_global_search_v2.sql`
