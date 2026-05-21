# Phase 21 closeout — Calendar export

**Status:** Complete (2026-05-20)

## Shipped

| Step | Flag | Doc |
|------|------|-----|
| 21.1 iCal subscribe | `enable_ical_subscribe` | `docs/P21-ICAL-SUBSCRIBE.md` |

## Migrations

Through `20260531900000_ical_subscribe.sql`.

## Deploy

```bash
supabase functions deploy ical-feed
```

## Next

See `docs/PHASE_12_BACKLOG.md` — candidates: sport practice pack (#102), study-group boards (#4), ICS timetable import (#6).
