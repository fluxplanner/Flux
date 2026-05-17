# Raw `localStorage` inventory (Phase 5 prep)

**Generated:** 2026-05-17  
**Method:** ripgrep count of `localStorage.(get|set|remove)Item` under `public/js/`.

## Counts by file

| File | Approx. matches |
|------|------------------|
| `public/js/app.js` | ~28 (helpers + migrations + keys that must stay raw until migrated) |
| `public/js/flux-pro.js` | 2 (helpers only; `proLoad`/`proSave` fallbacks) |
| `public/js/flux-toolbox.js` | 2 ( **`plannerLoad`/`plannerSave`** fallbacks only when **`load`/`save`** absent) |
| `public/js/flux-release-gate.js` | 4 (helpers; **`cachedEmail`** prefers **`fluxLoadStoredString`** when **`app.js`** loaded) |
| `public/js/flux-ai-mega.js` | 6 (fallback paths only) |
| `public/js/flux-personalization.js` | 0 |
| `public/js/flux-google-docs.js` | 0 (canonical **`load`/`save`** since wave 1) |
| `public/js/flux-ai-orchestrator.js` | 0 (memory + energy via **`load`/`save`** / **`window.readFluxEnergyLevel`**) |
| `public/js/flux-intelligence.js` | 0 |
| `public/js/owner-suite.js` | 2 (local nuke stash restore only) |
| `public/js/flux-gcal-push.js` | 4 |
| `public/js/core/storage.js` | 3 (dual-write by design) |
| `public/js/flux-staff-tabs.js` | 2 |
| `public/js/flux-visual.js` | 1 (fallback only) |
| `public/js/flux-reftool-units.js` | 2 |
| `public/js/flux-estimate-learn.js` | 2 |
| `public/js/flux-reference-tools.js` | 2 |
| `public/js/flux-ai-connections.js` | 2 |
| `public/js/flux-enhancements-v100.js` | 0 |
| `public/js/flux-canvas-panel.js` | 1 |
| `public/js/splash.js` | 1 (accent fallback before `app.js`) |

## Canonical rule

Planner data keys **should** use `load()` / `save()` from `app.js` so `fluxNamespacedKey()` and impersonation apply.

## Wave 1 (2026-05-17) — connections + Docs + Canvas hint

| File | Change |
|------|--------|
| `flux-ai-connections.js` | Replaced internal `lsGet`/`lsSet` with **`load`/`save`** for `flux_ai_connections_*` and model route keys |
| `flux-google-docs.js` | **`load`/`save`** for `flux_google_docs_primary_url` and connection-enabled check |
| `flux-canvas-panel.js` | Host guess fallback email: **`load('flux_last_user_email')`** (replaces dead `flux_user_email` key) |

Next targets (high count): **`flux-ai-mega.js`**, remaining **`app.js`** hotspots in the table.

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

## Migration plan (incremental)

1. Classify each raw access: *must stay global* (e.g. `sb-*`), *must use load/save*, *bug*.  
2. Fix highest-risk paths first (tokens, AI connections, Canvas, account switch).  
3. Add `FluxDebug.traceStorage` when `FLUX_DEBUG_STORAGE=1` or `flux_debug=on` to catch stragglers.
