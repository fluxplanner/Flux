# P31.1 — Wiki backlinks + graph

**Step ID:** `P31-WIKI-BACKLINKS`  
**Flag:** `enable_wiki_backlinks` (default **off**)  
**Backlog #52**

Obsidian-style `[[wikilinks]]` between notes with **outlinks**, **backlinks**, and an SVG **graph overview**.

## Syntax

| Form | Resolves to |
|------|-------------|
| `[[Note title]]` | Note with matching title (case-insensitive) |
| `[[1234567890]]` | Note with that numeric id |

Unresolved targets show as *broken* in the outlinks list.

## UI

- **Notes list** — banner with linked-note counts + **Graph** button
- **🔗 Linked** filter — notes containing wikilinks
- **Note editor** — `[[ ]]` toolbar button; panel with outlinks / backlinks
- **Graph modal** — circular layout; click node to open note

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_wiki_backlinks: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — wikilink UI hidden; `[[…]]` text remains in note bodies.

Migration: `20260532900000_wiki_backlinks.sql`
