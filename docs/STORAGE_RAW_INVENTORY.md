# Raw `localStorage` inventory (Phase 5 prep)

**Generated:** 2026-05-17  
**Method:** ripgrep count of `localStorage.(get|set|remove)Item` under `public/js/`.

## Counts by file

| File | Approx. matches |
|------|------------------|
| `public/js/app.js` | ~27 (helpers + migrations + keys that must stay raw until migrated) |
| `public/js/flux-pro.js` | 2 ( **`proLoad`/`proSave`** fallbacks use **`fluxNamespacedKey`**) |
| `public/js/flux-toolbox.js` | 2 ( **`plannerLoad`/`plannerSave`** fallbacks only when **`load`/`save`** absent) |
| `public/js/flux-release-gate.js` | 4 (helpers; **`cachedEmail`** prefers **`fluxLoadStoredString`** when **`app.js`** loaded) |
| `public/js/flux-ai-mega.js` | 2 (**`rawLoad`/`rawSave`** fallbacks only when **`load`/`save`** absent) |
| `public/js/flux-personalization.js` | 0 |
| `public/js/flux-google-docs.js` | 0 (canonical **`load`/`save`** since wave 1) |
| `public/js/flux-ai-orchestrator.js` | 0 (memory + energy via **`load`/`save`** / **`window.readFluxEnergyLevel`**) |
| `public/js/flux-intelligence.js` | 0 |
| `public/js/owner-suite.js` | 2 (owner nuke stash/restore only; stash keys are physical **`nk`**) |
| `public/js/flux-gcal-push.js` | 0 ( **`load`/`save`** only; token from **`sessionStorage`**) |
| `public/js/core/storage.js` | 3 ( **`localStorage`** only when **`window.FluxStorage`** absent; else **`load`/`save`**) |
| `public/js/flux-staff-tabs.js` | 2 ( **`ls`/`lsSet`** fallbacks when **`load`/`save`** absent) |
| `public/js/flux-visual.js` | 1 (pre-**`app.js`** **`flux_cursor_spotlight`** probe; namespaced + JSON **`false`**) |
| `public/js/flux-reftool-units.js` | 2 ( **`readUnitCat`/`writeUnitCat`** fallbacks when **`load`/`save`** absent) |
| `public/js/flux-estimate-learn.js` | 2 ( **`nk` + raw** fallback when **`load`/`save`** absent) |
| `public/js/flux-reference-tools.js` | 2 ( **`readToolTab`/`writeToolTab`** fallbacks) |
| `public/js/flux-ai-connections.js` | 0 ( **`load`/`save`** only) |
| `public/js/flux-enhancements-v100.js` | 0 |
| `public/js/flux-canvas-panel.js` | 0 ( **`load`/`save`** only; no **`localStorage`** API) |
| `public/js/splash.js` | 1 (accent **`getItem`** only when **`fluxLoadStoredString`** absent; namespaced + JSON-aware) |
| `index.html` (head) | 2 (first-paint **`flux_liquid_glass`** / **`flux_perf_snappy`**; legacy **`'1'`/`'0'`** + JSON tolerant, wave 19) |

## Canonical rule

Planner data keys **should** use `load()` / `save()` from `app.js` so `fluxNamespacedKey()` and impersonation apply.

## Wave 1 (2026-05-17) — connections + Docs + Canvas hint

| File | Change |
|------|--------|
| `flux-ai-connections.js` | Replaced internal `lsGet`/`lsSet` with **`load`/`save`** for `flux_ai_connections_*` and model route keys |
| `flux-google-docs.js` | **`load`/`save`** for `flux_google_docs_primary_url` and connection-enabled check |
| `flux-canvas-panel.js` | Host guess fallback email: **`load('flux_last_user_email')`** (replaces dead `flux_user_email` key) |

Next targets: **Phase 8 incremental routing** is complete for app modules; remaining raw **`localStorage`** in **`app.js`** / head / storage fallback is **documented** under **“Intentional raw `localStorage`”** above. Optional: add **`FluxDebug.traceStorage`** hooks on migration/compaction only if you need deeper audits.

## Wave 2 (2026-05-17)

| File | Change |
|------|--------|
| `flux-gcal-push.js` | **`load`/`save`** for `flux_gcal_auto_push` and `flux_gcal_pushed_map` |
| `flux-ai-orchestrator.js` | **`load`/`save`** for `flux_ai_agent_memory_v1`; **`readFluxEnergy()`** + **`save('flux_energy')`** instead of raw `localStorage` |

## Wave 3 (2026-05-17) — `flux_energy` canonical

| File | Change |
|------|--------|
| `public/js/app.js` | **`readFluxEnergyLevel()`** + **`window.readFluxEnergyLevel`**; **`setEnergy`** uses **`save('flux_energy', n)`**; all task-sort / topbar / “why” reads use **`readFluxEnergyLevel()`** |
| `public/js/flux-ai-mega.js` | Energy from **`window.readFluxEnergyLevel()`** with **`load`** fallback |
| `public/js/flux-intelligence.js` | Same |
| `public/js/flux-ai-orchestrator.js` | **`readFluxEnergy()`** prefers **`window.readFluxEnergyLevel()`** when present |

## Wave 4 (2026-05-17) — toolbox

| File | Change |
|------|--------|
| `public/js/flux-toolbox.js` | **`plannerLoad`/`plannerSave`** helpers; **`flux_timelines`** via **`loadTl`/`saveTl`**; **`flux_essay_draft`**, **`flux_cj_ai_cache_v1`**, **`flux_study_tools_layout`** via **`plannerSave`**; study tool + collapsed prefs: **namespaced `getItem` + JSON-or-raw parse** for reads, **`plannerSave`** for writes (legacy plain strings tolerated) |

## Wave 5 (2026-05-17) — flux-pro

| File | Change |
|------|--------|
| `public/js/flux-pro.js` | **`proLoad`/`proSave`**; achievements, pins, density, milestones, reflection, last-active task, cursor/mesh toggles — all via **`load`/`save`** when available |

## Wave 6 (2026-05-17) — release gate

| File | Change |
|------|--------|
| `public/js/flux-release-gate.js` | **`relLoad`/`relSave`/`relRemoveKey`**; gate, platform config merge, dev roster, first-seen key — **`load`/`save`** when available; **`flux_last_user_email`** via raw **`getItem`** (plain string; superseded in wave 11) |

## Wave 7 (2026-05-17) — `app.js` slice (prefs + notify + tab keys)

| File | Change |
|------|--------|
| `public/js/app.js` | **`fluxLoadLegacy01`/`fluxSaveLegacy01`** for **`0`/`1`** prefs (dash schedule expand, AI sidebar hidden / chats compact); **`fluxLoadStoredString`/`fluxSaveStoredString`** for **`flux_ai_mode`**; **`flux_notify_log`** + **`flux_ai_msg_count`** via **`load`/`save`**; remove **`flux_last_tab`** / **`flux_last_tab_ts`** with **`fluxNamespacedKey`** |

## Wave 8 (2026-05-17) — `app.js` + satellites (strings, streaks, mega)

| File | Change |
|------|--------|
| `public/js/app.js` | **`flux_chrome_extension_id`** in **`FLUX_IMPERSONATION_GLOBAL_KEYS`** (+ migration **`keepExact`**); **`window.fluxLoadLegacy01`**, **`fluxSaveLegacy01`**, **`fluxLoadStoredString`**, **`fluxSaveStoredString`**; splash, tomorrow/weekly review, **`flux_pref_role`**, pending staff read/clear, mood/stress today, timer prefill, cognitive-load **`flux_last_active_ms`** / **`flux_task_streak_n`**; Chrome extension UI via **`fluxLoadStoredString`/`fluxSaveStoredString`** |
| `public/js/flux-ai-mega.js` | Night bias JSON, break hint ts, explain level via **`load`/`save`** + **`window.fluxLoadStoredString`** fallbacks |
| `public/js/flux-personalization.js` | Liquid glass read, mood tint mood, perf snappy, streak, affirmation name — all **`load`/`save`** (no raw **`localStorage`**) |
| `public/js/flux-intelligence.js` | **`recordCompletionStreak`** → **`save`** for **`flux_task_streak_*`** |
| `public/js/flux-enhancements-v100.js` | Streak intel reads via **`load`/`fluxLoadStoredString`** |

## Wave 9 (2026-05-17) — theme / profile / accent

| File | Change |
|------|--------|
| `public/js/app.js` | **`flux_profile_pic`** global key; **`save('profile')`**; **`fluxLoadStoredString`/`fluxSaveStoredString`** for **`flux_theme`**, **`flux_accent`**, **`flux_accent_rgb`**, **`flux_user_name`**, **`flux_profile_pic`** across themes, sync, AI payload, onboarding, sign-in |
| `public/js/splash.js` | Accent: **`fluxLoadStoredString`** when **`app.js`** has run, else legacy **`getItem`** + quote strip |
| `public/js/flux-visual.js` | Nav squiggle accent via **`fluxLoadStoredString`** when present |

## Wave 10 (2026-05-17) — owner suite + compaction

| File | Change |
|------|--------|
| `public/js/owner-suite.js` | Owner analytics **`flux_streak_*`** via **`load`**; backup restore **`save('profile')`**; **`ownerNukeLocalState`** uses **`fluxNamespacedKey`** for stash/restore |
| `public/js/app.js` | **`checkDataVersion`** writes **`flux_data_version`** with **`save`**; **`fluxCompactStorageIfNeeded`**: **`flux_notes`** via **`load`/`save`**; AI chat keys matched with **`k.includes('flux_ai_chats')`** |

## Wave 11 (2026-05-17) — impersonation + account switch + migration keep-list

| File | Change |
|------|--------|
| `public/js/app.js` | **`shouldKeepKey`**: keep **`sb-*`**, keys containing **`supabase`**, and **`imp:`**; **`flux_last_user_*`** on **`FLUX_IMPERSONATION_GLOBAL_KEYS`** + **`fluxLoadStoredString`/`fluxSaveStoredString`**; **`FluxImpersonate`** + **`FluxRole.setMode`** → **`save`/`load`**; account-switch survivors via **`fluxNamespacedKey`** |
| `public/js/flux-release-gate.js` | **`cachedEmail`** → **`fluxLoadStoredString`** (+ legacy **`getItem`** parse fallback) |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 11 + counts |
| `docs/stabilization-checkpoint.md` | Wave 11 log |

## Wave 12 (2026-05-17) — `clearCache` + sign-out stash

| File | Change |
|------|--------|
| `public/js/app.js` | **`clearCache`**: **`fluxNamespacedKey`** for keep-list reads, preserve **`sb-*`** and keys containing **`supabase`**, **`clear` + restore** (session-safe while signed in); keep **`flux_data_version`** / **`flux_splash_shown`**; **`handleSignedOut`**: **`keysToKeep`** via **`fluxNamespacedKey`**, stash **`flux_last_user_*`** |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 12; **`flux-ai-orchestrator.js`** count corrected to **0** |
| `docs/stabilization-checkpoint.md` | Wave 12 log |

## Wave 13 (2026-05-17) — `flux-toolbox.js` polish

| File | Change |
|------|--------|
| `public/js/flux-toolbox.js` | **`plannerLoad`/`plannerSave`** no-`app.js` fallbacks use **`fluxNamespacedKey`**; **`lsStudyTool`** reads via **`fluxLoadStoredString`** when present (else **`plannerLoad`**) |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 13; **`flux-toolbox.js`** count **~2** (was stale at ~13) |
| `docs/stabilization-checkpoint.md` | Wave 13 log |

## Wave 14 (2026-05-17) — `flux-ai-mega.js` fallbacks

| File | Change |
|------|--------|
| `public/js/flux-ai-mega.js` | **`lsNk`/`rawLoad`/`rawSave`** for no-`app.js` paths; night bias, break hint ts, explain level use namespaced storage consistent with **`save()`** JSON |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 14; **`flux-ai-mega.js`** count **~2** |
| `docs/stabilization-checkpoint.md` | Wave 14 log |

## Wave 15 (2026-05-17) — small tools + Pro / visual

| File | Change |
|------|--------|
| `public/js/flux-estimate-learn.js` | **`load`/`save`** when present; **`nk` + JSON** fallback otherwise |
| `public/js/flux-reference-tools.js` | **`readToolTab`/`writeToolTab`** — **`load`/`save`** or namespaced JSON fallback |
| `public/js/flux-reftool-units.js` | **`readUnitCat`/`writeUnitCat`** — **`fluxLoadStoredString`** / **`save`** or namespaced fallback |
| `public/js/flux-pro.js` | **`proLoad`/`proSave`** no-**`app.js`** path uses **`fluxNamespacedKey`** |
| `public/js/flux-visual.js` | Early **`flux_cursor_spotlight`** check uses namespaced key + JSON boolean (matches **`proSave`**) |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 15; **`flux-gcal-push.js`** count **0** |
| `docs/stabilization-checkpoint.md` | Wave 15 log |

## Wave 16 (2026-05-17) — `app.js` polish

| File | Change |
|------|--------|
| `public/js/app.js` | **`loadTheme`**: first-visit theme probe via **`fluxLoadStoredString('flux_theme','')`** (no duplicate **`getItem`**); impersonation scrub + **`handleSignedIn`** use **`fluxNamespacedKey('flux_owner_impersonate')`**; **`estimateStorageBytes`** delegates to **`fluxEstimateLocalStorageBytes`** when defined |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 16; **`app.js`** count **~27** |
| `docs/stabilization-checkpoint.md` | Wave 16 log |

## Wave 17 (2026-05-17) — splash accent + owner nuke stash

| File | Change |
|------|--------|
| `public/js/splash.js` | **`fluxSplashAccentHex`** fallback: **`fluxNamespacedKey('flux_accent')`** + JSON-or-raw parse (matches **`save`**-stored strings) |
| `public/js/owner-suite.js` | **`ownerNukeLocalState`**: stash map keyed by **physical** storage keys, restore via **`Object.entries`** (same pattern as **`clearCache`**) |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 17 row notes |
| `docs/stabilization-checkpoint.md` | Wave 17 log |

## Wave 18 (2026-05-17) — staff tabs + inventory fix

| File | Change |
|------|--------|
| `public/js/flux-staff-tabs.js` | **`ls`/`lsSet`** prefer **`load`/`save`** from **`app.js`**; namespaced **`getItem`/`setItem`** only as fallback |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 18; **`flux-canvas-panel.js`** count **0**; **`flux-staff-tabs.js`** note |
| `docs/stabilization-checkpoint.md` | Wave 18 log |

## Wave 19 (2026-05-17) — first-paint prefs + storage docs

| File | Change |
|------|--------|
| `index.html` | Head scripts: tolerate legacy **`'1'`/`'0'`** and JSON for **`flux_liquid_glass`** / **`flux_perf_snappy`** (matches **`save`** / **`fluxSaveLegacy01`** shapes) |
| `public/js/app.js` | **`initFluxDebug`**: comment that debug **`lsGet`** keys stay unprefixed; **`fluxCompactStorageIfNeeded`**: comment why AI chat compaction uses physical keys |
| `public/js/core/debug.js` | Comment on unprefixed debug **`lsGet`** keys |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 19 + **`index.html`** row |
| `docs/stabilization-checkpoint.md` | Wave 19 log |

## Wave 20 (2026-05-17) — `FluxStorage` + ESM blob path

| File | Change |
|------|--------|
| `public/js/app.js` | **`window.FluxStorage = { load, save }`** for ESM consumers |
| `public/js/core/storage.js` | **`parseJson`/`setJson`** delegate to **`FluxStorage`** when present; else **`fluxNamespacedKey` + `localStorage`**; blob probe uses same split |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 20 + **`core/storage.js`** row note |
| `docs/stabilization-checkpoint.md` | Wave 20 log |

## Wave 21 (2026-05-17) — exceptions appendix (Phase 8 close-out)

| File | Change |
|------|--------|
| `docs/STORAGE_RAW_INVENTORY.md` | **“Intentional raw `localStorage`”** appendix: `app.js` migration / compaction / `fluxImpersonationPrefix` / `FluxDebug.lsGet`, `index.html` head, `core/storage.js` fallback |
| `docs/stabilization-checkpoint.md` | Step 8 + wave 21 log |

## Intentional raw `localStorage` (exceptions)

These paths **stay** on raw **`localStorage`** (or head **`getItem`**) by design — not bugs.

| Location | Why |
|----------|-----|
| **`public/js/app.js`** **`fluxImpersonationPrefix()`** | Reads global **`flux_owner_impersonate`** before **`load`** can safely depend on fully bootstrapped storage helpers. |
| **`public/js/app.js`** **`_fluxLoadRaw` / `_fluxSaveRaw`** | Implement **`load`/`save`**; the canonical boundary. |
| **`public/js/app.js`** **`fluxLoadLegacy01`** fallback | Raw **`getItem`** for legacy **`'1'`** prefs when JSON branch misses. |
| **`public/js/app.js`** **`fluxLoadStoredString`** fallback | Raw read for mixed JSON/plain string prefs. |
| **`public/js/app.js`** **`checkDataVersion`** | Iterates **physical** keys from **`Object.keys(localStorage)`**; **`removeItem(k)`** for keys outside the keep policy (migration). |
| **`public/js/app.js`** **`fluxCompactStorageIfNeeded`** | AI chat shards use **physical** keys (may include **`imp:…`**); must **`getItem`/`setItem`** that key as-is — **`load(logical)`** would re-namespace incorrectly. |
| **`public/js/app.js`** **`initFluxDebug` · `lsGet`** | **`flux_debug`**, **`FLUX_DEBUG*`** toggles are **device-global**, not per-impersonation bubble. |
| **`public/js/app.js`** **`fluxEstimateLocalStorageBytes` / `estimateStorageBytes`** | Full-browser quota estimate across **all** keys (incl. **`sb-*`**, **`imp:`**). |
| **`public/js/app.js`** | Account switch / **`clearCache` / `handleSignedOut` / `ownerNukeLocalState`**: **`clear`** + selective **`setItem`** on preserved physical keys. |
| **`index.html`** (head) | First-paint **`data-flux-glass`** / **`data-flux-perf`** before **`app.js`** runs. |
| **`public/js/core/storage.js`** | When **`window.FluxStorage`** is absent, **`nsKey` + `localStorage`** fallback (tests / load order). |
| **`public/js/core/debug.js`** · **`initFluxDebug` in `app.js` (legacy)** | Same unprefixed debug **`lsGet`** rule when **`debug.js`** not loaded. |

## Migration plan (incremental)

1. Classify each raw access: *must stay global* (e.g. `sb-*`), *must use load/save*, *bug*.  
2. Fix highest-risk paths first (tokens, AI connections, Canvas, account switch).  
3. Add `FluxDebug.traceStorage` when `FLUX_DEBUG_STORAGE=1` or `flux_debug=on` to catch stragglers.  
4. ~~Document intentional raw **`localStorage`** exceptions (see **“Intentional raw `localStorage`”** above).~~
