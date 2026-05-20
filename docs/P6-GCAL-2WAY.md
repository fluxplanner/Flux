# P6-GCAL-2WAY

**Step ID:** `P6-GCAL-2WAY`  
**Flag:** `enable_gcal_2way` (default **off**)

## Behavior

**Google Calendar two-way sync** with **overload-aware scheduling** (student/personal planner):

| Direction | Behavior |
|-----------|----------|
| **Pull** | Imports new Google events as `flux_events` or tasks (user choice); dedupes via `flux_gcal_2way_linked` |
| **Push** | Optional: pushes open dated tasks via `flux-gcal-push.js` (skips **high** load days when overload-aware) |
| **Overload** | 7-day workload strip from open tasks; per-day `ok` / `elevated` / `high`; hints on import list |

**UI** — Calendar panel → Google Calendar section (when flag on):

- Week load strip
- Import as events vs tasks
- Push open tasks + overload-aware toggles
- **Sync two-way** / **Suggest lighter dates** (tasks without due dates)

Legacy one-way sync remains when the flag is off.

## Modules

| File | Role |
|------|------|
| `public/js/flux-gcal-2way.js` | Sync, import map, overload heuristics, panel |
| `public/css/flux-gcal-2way.css` | Calendar panel styling |
| `public/js/flux-gcal-push.js` | Existing per-task push (reused for outbound) |
| `supabase/migrations/20260525350000_gcal_2way_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_gcal_2way: true };
await FluxFeatureFlags.load({ force: true });
FluxGCal2Way.install();
nav('calendar'); // or open Calendar tab
```

Sign in with Google (calendar scopes). Use **Sync two-way** on the calendar panel.

**API:** `fluxGCal2WaySuggestDueDate(taskId)` — sets due date to the lightest day in the next 7.

## Rollback

Disable flag; `syncGoogleCalendar()` reverts to legacy read-only list + manual “+ Task”.
