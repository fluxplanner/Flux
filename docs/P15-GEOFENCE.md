# P15.3 — Geofence reminders

**Step ID:** `P15-GEOFENCE`  
**Flag:** `enable_geofence_reminders` (default **off**)  
**Backlog #63**

Save campus places (library, gym) with coordinates and radius; get a toast (and browser notification if allowed) when you arrive.

## Behavior

| Feature | Detail |
|---------|--------|
| Settings | Alerts tab → Campus geofence card |
| Places | Name, lat/lon, radius (m), custom message |
| Watch | `watchPosition` while Flux is open |
| Cooldown | 4h per place between repeat nudges |
| ⌘K | “Geofence reminders” → Settings → Alerts |

Requires location permission. Works best on mobile with the app in foreground.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_geofence_reminders: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Settings → **Alerts** → add **Campus library** with **Use my location** → **Start location watch**.

## Rollback

Disable flag — watch stops, card removed.

Migration: `20260531200000_geofence_reminders.sql`
