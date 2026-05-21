# P24.1 — CS snippet library

**Step ID:** `P24-CS-SNIPPET-LIBRARY`  
**Flag:** `enable_cs_snippet_library` (default **off**)  
**Backlog #47**

Local-only code snippet library with tag search, light syntax highlighting, and JSON import/export.

## Features

- **Toolbox → Computer Science → Snippet library**
- 5 starter snippets (Python, JS, Java, SQL, C++)
- Tag + full-text search
- Copy, add to notes, delete
- User snippets saved in `flux_cs_snippet_library_v1` (cloud-synced slice)

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_cs_snippet_library: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Toolbox → CS → Snippet library.

## Rollback

Disable flag — tool chip hidden; local snippets remain.

Migration: `20260532200000_cs_snippet_library.sql`
