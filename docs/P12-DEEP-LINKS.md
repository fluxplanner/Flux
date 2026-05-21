# P12.1 — Entity deep links

**Step ID:** `P12-DEEP-LINKS`  
**Flag:** `enable_deep_links` (default **off**)  
**Backlog #10**

Open a specific task, note, or focus session from a shareable URL.

## URL params

| Param | Action |
|-------|--------|
| `?task={id}` | Dashboard → scroll + highlight task |
| `?task={id}&edit=1` | Same + open edit modal |
| `?note={id}` | Notes → open editor |
| `?focus={id}` | Start deep work on task (or best task if missing) |
| `?panel={tabId}` | Navigate tab (e.g. `calendar`, `timer`) |

Legacy `?quick=task` and share `?text=` still work via `handleDeepLinkParams`.

## Share UI

- Task row **🔗** when flag on → copies link
- Notes editor **🔗** when flag on
- Command palette: “Copy link to open task/note” when editing

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_deep_links: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Example: `https://yoursite/?task=1734567890123`

## Rollback

Disable flag — share buttons hidden; entity params ignored (legacy quick links still work).

Migration: `20260529200000_phase_12_deep_links_sync_queue.sql`
