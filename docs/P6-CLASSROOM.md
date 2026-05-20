# P6-CLASSROOM

**Step ID:** `P6-CLASSROOM`  
**Flag:** `enable_classroom_sync` (default **off**)

## Behavior

**Google Classroom sync** — pull active classes, coursework, and student grades into Flux tasks:

| Data | Source |
|------|--------|
| Classes | `courses.list` (ACTIVE) |
| Assignments | `courses.courseWork.list` per class |
| Grades | `studentSubmissions` for `userId=me` |

**Import**

- Per-row **+ Flux** → task with `classroomCourseId` / `classroomCourseWorkId` (deduped)
- **Import dated (new)** — bulk import assignments with due dates not already linked
- Turned-in / returned submissions mark task `done` when imported

**UI** — Integrations hub (Canvas tab panel) → **Classroom** tab when flag on.

Requires Google OAuth with Classroom scopes (`fluxReconnectGoogleClassroom()`).

## Modules

| File | Role |
|------|------|
| `public/js/flux-classroom-sync.js` | API fetch, cache, render, import |
| `public/css/flux-classroom-sync.css` | Hub table styling |
| `public/js/flux-google-hub.js` | Classroom tab + slot |
| `supabase/migrations/20260525360000_classroom_sync.sql` | Flag metadata |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_classroom_sync: true };
await FluxFeatureFlags.load({ force: true });
nav('canvas'); // Integrations hub
// Select Classroom tab → Sync Classroom
```

If API returns 403, use **Reconnect scopes** and approve Classroom permissions.

## Rollback

Disable flag; Classroom tab hidden. Cached hub data remains in localStorage but unused.
