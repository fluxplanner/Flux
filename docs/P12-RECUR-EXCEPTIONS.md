# P12.5 — Recurring task exceptions

**Step ID:** `P12-RECUR-EXCEPTIONS`  
**Flag:** `enable_recurring_exceptions` (default **off**)  
**Backlog #3**

Extends weekly/biweekly/monthly repeat with series rules synced to cloud via `user_data.recurringSeries`.

## Actions (🔁 on recurring task)

| Action | Effect |
|--------|--------|
| Complete without next | Marks done; no spawn |
| Skip next scheduled date | Next spawn jumps an extra cycle |
| Shift series +7 days | Adds 7 days to all open instances + future spawns |
| End after N | Stops spawning after N completions |

## Data model

- **Tasks:** `seriesId`, optional `seriesEndAfter`
- **Local + cloud:** `flux_recurring_series_v1` → `recurringSeries` in sync payload

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_recurring_exceptions: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Create a weekly task → complete → use 🔁 menu to skip or set end-after.

## Rollback

Disable flag — legacy repeat-on-complete behavior returns.

Migration: `20260529500000_recurring_exceptions.sql`
