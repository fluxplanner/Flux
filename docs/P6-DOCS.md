# P6-DOCS

**Step ID:** `P6-DOCS`  
**Flag:** `enable_docs_ghost_sync` (default **off**)

## Behavior

**Bidirectional sync** between a task’s **Ghost draft** and a linked **Google Doc**:

| Direction | Action |
|-----------|--------|
| **Push → Doc** | Writes ghost draft (or task name + notes) to the linked Doc body |
| **Pull ← Doc** | Reads Doc plain text back into `task.ghostDraft` |
| **Create & link** | New Google Doc titled from the task |
| **Use primary doc** | Links the Settings / hub primary doc URL to this task |

Per-task links persist in `flux_docs_ghost_links_v1` (and `task.googleDocId` / `task.googleDocUrl` when saved).

Works with **Ghost draft v2** (`enable_ghost_draft_v2`) on scaffold cards; legacy ghost blocks also get the doc bar when they show a draft.

## Modules

| File | Role |
|------|------|
| `public/js/flux-docs-ghost-sync.js` | Per-task link, push/pull, UI bar |
| `public/css/flux-docs-ghost-sync.css` | Doc bar on task cards |
| `public/js/flux-google-docs.js` | `FluxGoogleDocs` API (read/write/create) |
| `public/js/flux-google-hub.js` | Docs hub help blurb |
| `supabase/migrations/20260525380000_docs_ghost_sync.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_docs_ghost_sync: true,
  enable_ghost_draft_v2: true, // recommended for scaffold UI
};
await FluxFeatureFlags.load({ force: true });
FluxDocsGhostSync.install();
// Open a task with a ghost draft → use Push / Pull on the card
```

Connect Google Docs in Settings if push/pull returns 403.

## Rollback

Disable flag; doc bars hidden. Existing `ghostDraft` text and Doc links in localStorage remain but are unused.
