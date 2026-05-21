# P12.7 — Command palette v2

**Step ID:** `P12-CMD-PALETTE-V2`  
**Flag:** `enable_cmd_palette_v2` (default **off**)  
**Backlog #9**

Extends ⌘K with fuzzy matching, recent commands, and navigation to every visible tab surface.

## Behavior

| Feature | Detail |
|---------|--------|
| Fuzzy match | Subsequence + substring scoring on label, subtitle, category, keys |
| Recents | Last 10 runs appear under **Recent** when the palette opens empty |
| Surfaces | **Surfaces** group adds any visible tab not already in the static nav list |
| Cloud | `cmdPaletteRecents` synced in user payload |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_cmd_palette_v2: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Open ⌘K → run a few commands → reopen → recents appear. Type partial text (`cal`, `foc`) to fuzzy-match.

## Rollback

Disable flag — legacy substring filter and static command list only.

Migration: `20260529700000_cmd_palette_v2.sql`
