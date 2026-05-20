# P1-STORAGE

**Step ID:** `P1-STORAGE`  
**Registry:** `public/js/flux-storage-keys.js`

## What shipped

| Piece | Purpose |
|-------|---------|
| `FluxStorageKeys` | Platform key names, global-prefix policy, `plannerLoad`/`plannerSave` helpers |
| Per-user flag cache | `flux_feature_flags_cache_v1_<userId>` + `userId` in payload (no cross-account bleed) |
| Global prefixes | `flux_staff_mode_*`, `flux_feature_flags_cache_v1*` unprefixed by impersonation (device/auth scoped) |
| Sign-out / account switch | `FluxFeatureFlags.clear()` on `handleSignedOut` and account switch |
| `FluxFeatureFlags` | Uses `window.FluxStorage` (not bare `load`/`save` — separate script scope) |
| Audit helper | `FluxStorageKeys.auditStragglers()` in devtools |

## Rules for new features

1. **Planner data** → `load(key, def)` / `save(key, val)` via `app.js` (or `FluxStorage` from satellite modules).
2. **Never** raw `localStorage` for `flux_*` keys unless listed in `docs/STORAGE_RAW_INVENTORY.md` exceptions.
3. **Per-user prefs** → suffix `_<userId>` or use `FluxStorageKeys.userKey(base, uid)`.
4. **OAuth tokens** → `sessionStorage` (`flux_gmail_token`) or global integration prefixes.
5. Register new keys in `FluxStorageKeys.PLATFORM` and wave notes in `STORAGE_RAW_INVENTORY.md`.

## QA

```javascript
localStorage.setItem('FLUX_DEBUG_STORAGE', '1');
// toggle a setting, reload — console shows [FluxStorage] with namespacedKey

FluxStorageKeys.auditStragglers();
```

Sign in as user A → sign in as user B → feature flags refetch (no stale A cache).

## Related docs

- `docs/STORAGE_RAW_INVENTORY.md` — full wave history + intentional raw exceptions
- `docs/QA_MATRIX.md` §5
