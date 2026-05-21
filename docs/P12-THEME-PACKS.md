# P12.6 — Subject theme packs

**Step ID:** `P12-THEME-PACKS`  
**Flag:** `enable_subject_theme_packs` (default **off**)  
**Backlog #8**

Per-class color and icon presets with JSON export/import. Synced via `user_data.subjectThemePack`.

## UI

- **Settings → Appearance:** Subject theme packs card (above Themes)
- **Presets:** Vivid, Pastel STEM, Deep Ocean, Monochrome
- **Export / import:** Share `flux-subject-theme.json` with classmates
- **Tasks:** Subject chip shows icon when set

## Data model

- **Classes:** `color`, optional `icon` on each `flux_classes` entry
- **Local + cloud:** `flux_subject_theme_pack_v1` → `subjectThemePack` in sync payload  
  Tracks `activePreset` or `customPack` metadata

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_subject_theme_packs: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Add classes in School → Settings → Appearance → apply a preset → export JSON → import on another profile.

## Rollback

Disable flag — class colors/icons remain in local data but theme card and chip icons hide.

Migration: `20260529600000_subject_theme_packs.sql`
