# P10.2 — Locale UI strings (Phase 9 surfaces)

**Step ID:** `P10-I18N-STRINGS`  
**Flag:** `enable_locale_foundation` (no new migration)

Translates high-traffic UI added in Phase 9–10 via `window.fluxT(key, { vars })`.

## Surfaces

| Area | Keys prefix |
|------|-------------|
| Sync conflict modal + banner + Data card | `sync.*` |
| Storage repair card | `storage.*` |
| Dashboard widget picker (Appearance) | `dash.*`, `cal.*` |
| Task preview in conflict modal | `task.*`, `note.*`, `event.*` |

## Locales

`en-US`, `es-US`, `fr-FR`, `ar-SA` — see `STRINGS` in `public/js/flux-i18n.js`.

## API

```javascript
window.fluxT('sync.keep_mine'); // English when locale flag off
window.fluxT('sync.stat_conflicts', { n: 2 });
```

Changing locale re-renders panel layout, storage repair, and sync pills (`FluxI18n.refreshLocaleSurfaces`).

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_locale_foundation: true,
  enable_offline_sync: true,
  enable_sync_conflict_ui: true,
  enable_storage_repair: true,
};
await FluxFeatureFlags.load({ force: true });
FluxI18n.install();
```

Settings → Appearance → **Español** → open sync conflict modal or storage repair card.

## Rollback

Disable `enable_locale_foundation`; `fluxT` returns English.
