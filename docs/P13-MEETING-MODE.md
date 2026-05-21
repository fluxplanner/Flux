# P13.7 — Meeting mode

**Step ID:** `P13-MEETING-MODE`  
**Flag:** `enable_meeting_mode` (default **off**)  
**Backlog #22**

Collapse distractions during class or meetings: focus shell + banner timer + auto-reply snippet.

## Behavior

| Feature | Detail |
|---------|--------|
| Focus shell | Enables existing focus mode chrome collapse |
| Meeting banner | Label + countdown + copy auto-reply + Exit |
| Toasts | Info toasts suppressed while active (errors/warnings still show) |
| Timer card | Focus Timer → start 25–90 min session |
| Auto-reply | Clipboard snippet with end time |
| ⌘K | “Start meeting mode” |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_meeting_mode: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Focus Timer → Meeting mode → Start → distractions hidden, banner shows countdown.

## Rollback

Disable flag — standard focus mode / full UI returns.

Migration: `20260530400000_meeting_mode.sql`
