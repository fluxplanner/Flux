# P10.1 — localStorage repair

**Step ID:** `P10-STORAGE-REPAIR`  
**Flag:** `enable_storage_repair` (default **off**)

Scans critical planner keys for corrupt JSON (truncated sync, manual edits, quota errors) and repairs or resets them safely on-device.

## Keys scanned

`tasks`, `flux_notes`, `flux_events`, `flux_classes`, `flux_settings`, `flux_journal_lines`, `flux_dashboard_hidden_sections_v1`, `flux_layout_dashboard_v1`, `flux_quick_add_history`, `flux_dna`

## Repair order

1. Parse raw value — if valid, **ok**.
2. **Salvage** — trim to last closing `]` or `}` and re-parse.
3. **Reset** — write type-appropriate default via namespaced `save`.
4. **Remove** — delete key if write fails.

## UI

Settings → **Data & info** → **Storage repair** → **Scan & repair**.

With flag on, one automatic scan runs per browser session (toast only when issues fixed).

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_storage_repair: true };
await FluxFeatureFlags.load({ force: true });
FluxStorageRepair.install();
```

Test: DevTools → Application → corrupt `tasks` JSON → Scan & repair → tasks reload as `[]` or salvaged array.

## Rollback

Disable flag; card hidden. Repair log remains in `flux_storage_repair_log_v1` (local only).

Migration: `20260528900000_storage_repair.sql`
