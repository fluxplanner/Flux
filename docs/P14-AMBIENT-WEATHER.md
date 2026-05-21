# P14.5 — Ambient dashboard weather

**Step ID:** `P14-AMBIENT-WEATHER`  
**Flag:** `enable_ambient_weather` (default **off**)  
**Backlog #33**

Live weather on the dashboard with sunset time and an outdoor study window hint. Uses [Open-Meteo](https://open-meteo.com/) (no API key).

## Behavior

| Feature | Detail |
|---------|--------|
| Dashboard card | Below greeting — temp, condition, location |
| Sunset | Today’s sunset from forecast |
| Study hint | Outdoor vs indoor suggestion from temp, rain, daylight |
| Location | Geolocation, manual lat/lon, or default (NYC area) |
| Cache | 30 min local cache; prefs sync to cloud |
| ⌘K | “Refresh ambient weather” → Dashboard |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_ambient_weather: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Dashboard → weather card → **Use my location** or **Refresh**.

## Rollback

Disable flag — card removed; no network calls.

Migration: `20260530900000_ambient_weather.sql`
