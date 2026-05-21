# P35.1 — Citation helper

**Step ID:** `P35-CITATION-HELPER`  
**Flag:** `enable_citation_helper` (default **off**)  
**Backlog #64**

MLA 9 / APA 7 / Chicago 17 citation builder with **saved library**, **note insert**, and **bibliography export**. Extends the toolbox citation builder for everyday paper writing.

## Features

| Action | Result |
|--------|--------|
| **Build** | Live preview for web, book, journal, news sources |
| **Save to library** | Up to 80 citations synced via cloud slice |
| **Insert into note** | Appends formatted citation paragraph |
| **Export bibliography** | `flux-bibliography.txt` sorted A→Z |
| **Library click** | Re-insert saved citation into open note |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_citation_helper: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — banner and ❝ Cite button hidden; saved library data retained.

Migration: `20260533300000_citation_helper.sql`
