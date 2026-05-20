# P9.4 — Educator date formatting

**Step ID:** `P9-I18N-EDUCATOR`  
**Flag:** `enable_locale_foundation` (same as P8-I18N; no new migration)

Locale-aware dates in staff and educator surfaces via `fluxFmtStaffDate` / `fmtFluxDate`.

## Surfaces updated

| Module | Examples |
|--------|----------|
| `flux-caseload-engine.js` | Meeting log timestamps |
| `flux-classroom-tools.js` | Hall pass out times |
| `flux-classroom-sync.js` | Last Classroom sync line |
| `flux-educator-platform-extras.js` | Admin greet, meeting requests, school calendar, appt picker |
| `flux-staff-tabs.js` | Lesson hub, operations, workboard greets + stamps |
| `flux-staff-platform.js` | Work/personal dashboard sublines |
| `flux-i18n.js` | `fluxFmtStaffDate*` helpers; re-render staff widgets on locale change |

## Globals

| Global | Role |
|--------|------|
| `window.fluxFmtStaffDate(iso, style)` | Date labels (`short`, `weekday`, `monthDay`, …) |
| `window.fluxFmtStaffTime(d, opts)` | Time labels |
| `window.fluxFmtStaffDateTime(iso)` | Combined stamp |

When `enable_locale_foundation` is off, behavior matches `en-US` (same as student dashboard).

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_locale_foundation: true,
  enable_staff_productivity_suite: true,
  enable_caseload_engine: true,
};
await FluxFeatureFlags.load({ force: true });
FluxI18n.install();
// Open counselor workspace → meeting log; switch locale in Settings → Appearance
```

## Rollback

Disable `enable_locale_foundation`; educator strings revert to English formatting.
