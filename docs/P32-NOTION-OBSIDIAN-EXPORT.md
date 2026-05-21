# P32.1 — Notion / Obsidian export

**Step ID:** `P32-NOTION-OBSIDIAN-EXPORT`  
**Flag:** `enable_notion_obsidian_export` (default **off**)  
**Backlog #86**

Export Flux notes as **Obsidian-ready Markdown** with YAML front matter. **Notion:** copy Markdown from the editor or import individual `.md` files.

## Formats

| Action | Output |
|--------|--------|
| **Download ZIP vault** | `flux-notes-obsidian-YYYY-MM-DD.zip` with one `.md` per note + README |
| **↓ MD** (editor) | Single note file with front matter |
| **📋** (editor) | Copy full Markdown to clipboard |

## Front matter

```yaml
---
title: Biology
flux_id: 1234567890
tags:
  - "#review"
subject: science
starred: true
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-02T00:00:00.000Z
flashcards: 8
---
```

Body converts HTML headings, lists, bold/italic, and code to Markdown. `[[wikilinks]]` in plain text are preserved.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_notion_obsidian_export: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — export banner and editor buttons hidden.

Migration: `20260533000000_notion_obsidian_export.sql`
