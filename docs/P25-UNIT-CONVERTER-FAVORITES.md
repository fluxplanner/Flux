# P25.1 — Unit converter favorites

**Step ID:** `P25-UNIT-CONVERTER-FAVORITES`  
**Flag:** `enable_unit_converter_favorites` (default **off**)  
**Backlog #39**

Pin favorite unit conversions next to **quick-add** for one-tap results while typing tasks.

## Features

- Chip strip appears when quick-add is open (N key or +)
- 6 starter pins: in→cm, ft→m, lb→kg, °C→°F, mph→km/h, cup→mL
- Tap chip → inserts `1 in = 2.54 cm` into quick-add + copies to clipboard
- **+ Add** / **Manage** to customize favorites
- Uses `FluxUnitConverter` from `flux-reftool-units.js`

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_unit_converter_favorites: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Press **N** → quick-add → tap a conversion chip.

## Rollback

Disable flag — strip hidden; saved favorites remain in local storage.

Migration: `20260532300000_unit_converter_favorites.sql`
