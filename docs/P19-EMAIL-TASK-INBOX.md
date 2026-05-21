# P19.1 — Email-to-task staging inbox

**Step ID:** `P19-EMAIL-TASK-INBOX`  
**Flag:** `enable_email_task_inbox` (default **off**)  
**Backlog #18**

Forward or scan syllabus emails into a **staging queue** — nothing becomes a task until you approve it.

## Flow

| Step | Action |
|------|--------|
| Paste | Subject + body → parsed name, due date, type |
| Scan Gmail | Inbox query for due/deadline/assignment (14 days) — needs Google sign-in |
| Approve | Creates task with `source: email_inbox` |
| Dismiss | Removes from queue |

Parsed fields use `parseNLTask` + date regex (same family as Gmail educator import).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_email_task_inbox: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

**Settings → Data** → Email task inbox card.

## Rollback

Disable flag — card hidden; approved tasks remain.

Migration: `20260531700000_email_task_inbox.sql`
