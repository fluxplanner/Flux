# P6-GMAIL

**Step ID:** `P6-GMAIL`  
**Flag:** `enable_gmail_educator_import` (default **off**)

## Behavior

**Educator Gmail → task import** — smarter inbox import for teachers, counselors, staff, and admins (students keep the legacy Gmail list when the flag is on).

| Feature | Details |
|---------|---------|
| Filters | Inbox, unread, last 7 days, parent/guardian, school keywords |
| Parsing | Due dates from subject/snippet; priority/type heuristics |
| Dedupe | `gmailMessageId` on tasks + `flux_gmail_imported_map_v1` |
| Bulk | **Import action items** — emails scored as likely action-needed (max 8) |
| UI | Integrations hub → **Gmail** tab (replaces `loadGmail` for educators) |

Uses existing Gmail OAuth (`gmail.readonly`).

## Modules

| File | Role |
|------|------|
| `public/js/flux-gmail-educator.js` | Fetch, parse, import, UI |
| `public/css/flux-gmail-educator.css` | Inbox list styling |
| `supabase/migrations/20260525390000_gmail_educator_import.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_gmail_educator_import: true };
await FluxFeatureFlags.load({ force: true });
FluxGmailEducator.install();
nav('canvas');
FluxGoogle.setTab('gmail');
```

Sign in as **teacher / counselor / staff / admin** with Google.

## Rollback

Disable flag; educators get legacy Gmail list (`+ Task` with snippet only).
