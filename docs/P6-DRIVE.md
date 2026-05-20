# P6-DRIVE

**Step ID:** `P6-DRIVE`  
**Flag:** `enable_drive_import` (default **off**)

## Behavior

**Google Drive import** — list recent Docs, Slides, and PDFs; export text; generate drafts:

| Action | Who | Result |
|--------|-----|--------|
| **Generate lesson draft** | Teacher | Markdown lesson plan copied to clipboard (objectives, hook, instruction, exit ticket) |
| **Open in Lesson AI** | Teacher (`enable_teacher_ai`) | Prefills `FluxTeacherLessonAI` topic + notes from file |
| **Generate assignment** | Teacher | Prefills **Post new assignment** modal (title, description, type, due date) |
| **+ Add as Flux task** | Student / anyone | Creates a planner task with notes + Drive link |

**UI** — Integrations hub → **Drive** tab. Teachers also get **Drive import** on Lesson Hub (opens hub → Drive tab).

Uses Drive API v3 (`drive.readonly`) + export for Google Workspace files.

## Modules

| File | Role |
|------|------|
| `public/js/flux-drive-import.js` | List, export, generate, render |
| `public/css/flux-drive-import.css` | Hub panel styles |
| `public/js/flux-google-hub.js` | Drive tab + slot |
| `supabase/migrations/20260525370000_drive_import.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_drive_import: true };
await FluxFeatureFlags.load({ force: true });
nav('canvas');
FluxGoogle.setTab('drive');
```

Use **Reconnect scopes** if Drive API returns 403.

## Rollback

Disable flag; Drive tab and Lesson Hub button hidden.
