# P21.1 — iCal subscribe export

**Step ID:** `P21-ICAL-SUBSCRIBE`  
**Flag:** `enable_ical_subscribe` (default **off**)  
**Backlog #5**

Live **subscribe URL** for open tasks (+ optional focus blocks) in Apple Calendar, Google Calendar, etc.

## Flow

1. **Calendar** tab → iCal subscribe card (below Google sync)
2. **Publish feed** — upserts ICS snapshot + token to `flux_ical_feeds`
3. Copy **webcal://** or **https://** subscribe URL
4. Calendar app refreshes periodically (typically ~15 min)

Includes day-before `VALARM` on due tasks (same as legacy `.ics` download).

## Edge function

`GET /functions/v1/ical-feed?t={token}` → `text/calendar` body (service role lookup by token).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_ical_subscribe: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Sign in → Calendar → Publish feed → paste webcal URL into Calendar → Subscribe.

## Rollback

Disable flag — card hidden; revoke by regenerating token while flag off or deleting feed row.

Migration: `20260531900000_ical_subscribe.sql` · Deploy: `supabase functions deploy ical-feed`
