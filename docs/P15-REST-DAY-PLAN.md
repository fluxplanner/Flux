# P15.2 — Rest day adaptive plan

**Step ID:** `P15-REST-DAY-PLAN`  
**Flag:** `enable_rest_day_plan` (default **off**)  
**Backlog #59**

Dashboard adaptive plan for sick/lazy rest days — builds on `flux_rest_days_v1` and `flushTasksOffRestDays()`.

## Behavior

| Mode | Actions |
|------|---------|
| Not rest day | Quick **Sick day** / **Lazy day** mark buttons |
| Sick day | Push all due tasks forward, mood check-in link, optional micro-task list |
| Lazy day | Defer heavy tasks only, push all, up to 2 easy-win suggestions |
| Auto defer | On mark, runs `flushTasksOffRestDays()` (pref default on) |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_rest_day_plan: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Dashboard → **Recovery mode** → **Lazy day** → adaptive plan card appears.

## Rollback

Disable flag — card hidden; legacy rest-day calendar markers unchanged.

Migration: `20260531100000_rest_day_plan.sql`
