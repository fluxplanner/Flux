# Flux Planner — Stabilization checkpoint

**Created:** 2026-05-17  
**Purpose:** Safety baseline before incremental hardening. **No large rewrites** — extend canonical authorities only.

---

## Git checkpoint instructions (run locally before risky merges)

1. Ensure a clean tree or commit WIP to a branch:
   ```bash
   git status
   git checkout -b stabilization/2026-05-17
   ```
2. Create an annotated tag after docs + debug wiring land:
   ```bash
   git add docs/stabilization-checkpoint.md ARCHITECTURE_AUDIT_V2.md docs/RLS_AUDIT.md docs/STORAGE_RAW_INVENTORY.md public/js/core/debug.js
   git commit -m "docs: stabilization checkpoint + audit v2 + debug core"
   git tag -a stabilization-checkpoint-2026-05-17 -m "Pre-hardening baseline: checkpoint, ARCHITECTURE_AUDIT_V2, RLS audit, FluxDebug core"
   ```
3. Rollback strategy (single feature):
   ```bash
   git revert <commit-sha>
   ```
   Full rollback to tag:
   ```bash
   git checkout stabilization-checkpoint-2026-05-17
   ```
4. Do **not** force-push shared branches. Prefer revert commits.

---

## Current architecture authorities (canonical)

| Area | Owner | Notes |
|------|--------|------|
| Panel routing / visibility | `nav()` in `public/js/app.js` | `logicalId`, educator remap, **`assertRoleAccess`** after remap, `fns` dispatch |
| Role UX | `FluxRole` + `applyRoleUI()` + `updateModeSwitchUI()` + **`assertRoleAccess()`** (UX only; RLS authoritative) |
| Impersonation | `FluxImpersonate` + `fluxNamespacedKey` / `load` / `save` | Sync short-circuit elsewhere |
| Storage (planner) | `load` / `save` via `fluxNamespacedKey` | Parallel: `public/js/core/storage.js` blob path |
| Events | `FluxBus` + `flux-nav` `CustomEvent` | Not interchangeable |
| AI | `app.js` (chats) + `flux-ai-*.js` | Multiple listeners — order-sensitive |
| Canvas | `flux-canvas-panel.js` + `nav('canvas')` | Split layout interacts with `.panel` CSS |
| Staff / educator UI | `flux-staff-platform.js`, `flux-staff-tabs.js`, `flux-educator-platform-extras.js` | Fragmentation risk |
| Debug | `public/js/core/debug.js` → `window.FluxDebug` | `app.js` retains legacy fallback if script omitted |

---

## Current known issues (inventory)

1. **Dual storage paths:** raw `localStorage` in many modules bypasses impersonation prefix (see `docs/STORAGE_RAW_INVENTORY.md`).
2. **Multiple writers to “active” UI:** `nav()` vs tab internals vs CSS `!important` (see `ARCHITECTURE_AUDIT.md` + V2).
3. **Empty / stub UI hooks:** e.g. `renderSmartSug()`, `renderSidebarMiniStats()` in `app.js`.
4. **RLS:** `user_roles` educator-wide SELECT policy may allow enumeration — verify live DB (`docs/RLS_AUDIT.md`).
5. **Duplicate extensions:** `chrome-extension/` vs `flux-extension/` — audit only; no removal in this checkpoint.
6. **Next.js shell (`web/`):** parallel product surface; not the root SPA authority.

---

## Risks if we move fast without instrumentation

- Regressions in **Canvas AI split**, **mobile drawer**, **educator panel** cleanup on account switch.
- **Ghost AI** state or duplicate `task_completed` handlers.
- **Token bleed** on account switch if raw storage holds OAuth-ish keys outside global allowlists.

---

## Rollback (feature-level)

- **Debug / nav tracing:** remove `<script defer src="public/js/core/debug.js">` from `index.html` and revert `app.js` `nav()` / `initFluxDebug` edits.
- **RLS fixes:** always ship as new migration files; never edit applied history in place.
- **`assertRoleAccess`:** revert the function + the `_gate` block inside `nav()` in `public/js/app.js`.

---

## Experiment flags (future)

`window.FLUX_EXPERIMENTS` is initialized from `public/js/core/debug.js` (safe defaults). Flip in console only until a formal matrix exists (`docs/QA_MATRIX.md` — planned).

---

## Next incremental steps (approved order)

1. ~~Checkpoint doc (this file)~~  
2. ~~`ARCHITECTURE_AUDIT_V2.md`~~  
3. ~~`public/js/core/debug.js` + `index.html` + `app.js` merge / `nav` panel trace~~  
4. ~~`docs/RLS_AUDIT.md`~~  
5. ~~`docs/STORAGE_RAW_INVENTORY.md`~~  
6. ~~`docs/QA_MATRIX.md`~~ (stub — expand in Phase 15)  
7. ~~`assertRoleAccess` + `nav()` integration (Phase 6)~~  
8. Route raw `localStorage` → **`load`/`save`** (incremental): ~~waves 1–3~~ · ~~wave 4 (`flux-toolbox.js`)~~ · ~~wave 5 (`flux-pro.js`)~~ · ~~wave 6 (`flux-release-gate.js`)~~ · ~~wave 7a (`app.js` prefs / notify / tab keys)~~ · ~~wave 8 (`app.js` strings + streaks + mega + personalization + intelligence + enhancements)~~ · ~~wave 9 (theme / profile / accent + splash + visual)~~ · ~~wave 10 (owner-suite + compaction + data version save)~~ · ~~wave 11 (`app.js` migration keep-list + impersonation + account switch + `flux_last_user_*`)~~ · ~~wave 12 (`app.js` clear-cache + sign-out stash)~~ · ~~wave 13 (`flux-toolbox.js` fallbacks + study-tool read)~~ · next: **`flux-ai-mega.js`**, remaining **`app.js`** hotspots, …  
9. CSS z-index tokens + panel rule normalization (Phase 4)  

---

## Change log — stabilization bundle (2026-05-17)

### WHAT (files + functions)

| File | Change |
|------|--------|
| `docs/stabilization-checkpoint.md` | New — this checkpoint |
| `ARCHITECTURE_AUDIT_V2.md` | New — 27-area authority map |
| `docs/RLS_AUDIT.md` | New — migration-based RLS review |
| `docs/QA_MATRIX.md` | New — expandable QA stub |
| `public/js/core/debug.js` | New — `window.FluxDebug` (+ `FLUX_EXPERIMENTS`) |
| `index.html` | Insert `<script defer src="public/js/core/debug.js">` **before** `app.js` |
| `public/js/app.js` | `initFluxDebug`: early return if `FluxDebug.__fromCoreModule`; legacy `onFlag` honors `flux_debug=on`; `nav()`: `FluxDebug.tracePanels(...)` after panel activate; **`assertRoleAccess` + `nav()` gate** |

### WHY

- Need a **frozen baseline** (docs + tag instructions) before routing/storage/RLS edits.  
- `FluxDebug` lived only inside `app.js`; moving the canonical implementation to **`public/js/core/debug.js`** allows earlier load order and **one** module to extend (log, perf, panel) without touching storage primitives first.  
- **`user_roles` SELECT policy** risk was identified in prior review — captured in `docs/RLS_AUDIT.md` for a follow-up migration.  
- **Panel lifecycle**: `nav()` already logged dup `.active` panels when `FLUX_DEBUG_NAV=1`; **`tracePanels`** adds explicit post-activate state for Phase 3.

### RISK

| Risk | Mitigation |
|------|------------|
| Script order breaks if `debug.js` missing | `app.js` **legacy `initFluxDebug`** still runs if core flag absent |
| Extra `console` work | All gated behind `flux_debug` / `FLUX_DEBUG*` |
| `FLUX_EXPERIMENTS` frozen object blocked console mutation | **Revised:** `debug.js` uses a plain mutable object (not frozen) so experiments can be toggled in devtools |

### ROLLBACK

- Revert commit touching `index.html`, `app.js`, `public/js/core/debug.js`; keep docs or revert as a unit.  
- Remove tag if created: `git tag -d stabilization-checkpoint-2026-05-17`

---

## Change log — `assertRoleAccess` (Phase 6, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/app.js` | **`assertRoleAccess(panelId)`** → `{ ok, reason?, fallbackId? }`; exposed as **`window.assertRoleAccess`**; **`nav()`** runs gate after educator `logicalId` remap; deny → **`nav(fallbackId)`** + return |

**Why:** Defense in depth for educator-only panels if remap/deep-link races miss an edge. **Risk:** false positive deny sends user to `dashboard` / role home — mitigated by matching existing remap targets. **Rollback:** revert the function definition and the `_gate` block in `nav()`.

---

## Change log — storage wave 1 (Phase 8 prep, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/flux-ai-connections.js` | AI connection JSON + model route: **`load`/`save`** instead of raw `localStorage` |
| `public/js/flux-google-docs.js` | Primary doc URL + connection toggle read: **`load`/`save`** |
| `public/js/flux-canvas-panel.js` | Canvas host guess email fallback: **`load('flux_last_user_email')`** (fixes unused `flux_user_email` key) |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 1 table + next targets |

**Why:** Single storage authority + correct namespacing / impersonation behavior for AI + Docs paths. **Rollback:** revert the four files above.

---

## Change log — storage wave 2 (2026-05-17)

| File | Change |
|------|--------|
| `public/js/flux-gcal-push.js` | GCal auto-push + pushed task map: **`load`/`save`** |
| `public/js/flux-ai-orchestrator.js` | Agent memory JSON + **`flux_energy`** read/write via **`load`/`save`** + **`readFluxEnergy()`** |

**Rollback:** revert those two files + doc touch-ups (`docs/STORAGE_RAW_INVENTORY.md`, `docs/stabilization-checkpoint.md`).

---

## Change log — storage wave 3 (`flux_energy`, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/app.js` | **`readFluxEnergyLevel`**, **`window.readFluxEnergyLevel`**, **`setEnergy` → `save`**, all **`flux_energy`** reads → **`readFluxEnergyLevel()`** |
| `public/js/flux-ai-mega.js` | **`window.readFluxEnergyLevel()`** (+ load fallback) |
| `public/js/flux-intelligence.js` | Same |
| `public/js/flux-ai-orchestrator.js` | **`readFluxEnergy()`** delegates to **`window.readFluxEnergyLevel`** when available |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 3 table |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert the five files above.

---

## Change log — storage wave 4 (`flux-toolbox.js`, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/flux-toolbox.js` | **`plannerLoad`/`plannerSave`**; timelines / essay / conjugation cache / layout; study prefs with legacy-safe reads |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 4 row + next targets |

**Rollback:** revert `flux-toolbox.js` + doc edits.

---

## Change log — storage wave 5 (`flux-pro.js`, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/flux-pro.js` | **`proLoad`/`proSave`**; achievements, pins, density, milestones, reflection, last-active task, cursor/mesh — **`load`/`save`** when present |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 5 table; **`flux-pro.js`** count → helpers-only |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert `flux-pro.js` + doc edits.

---

## Change log — storage wave 6 (`flux-release-gate.js`, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/flux-release-gate.js` | **`relLoad`/`relSave`/`relRemoveKey`**; gate + **`flux_platform_config`** merge + **`flux_dev_accounts`** + first-seen marker |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 6 table; release-gate count; next targets → **`app.js`** |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert `flux-release-gate.js` + doc edits.

---

## Change log — storage wave 7a (`app.js` slice, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/app.js` | **`fluxLoadLegacy01`/`fluxSaveLegacy01`**, **`fluxLoadStoredString`/`fluxSaveStoredString`**; **`flux_notify_log`**, **`flux_ai_msg_count`**, AI sidebar layout flags, dash schedule expand, **`flux_ai_mode`**; namespaced **`flux_last_tab`** cleanup |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 7 table; **`app.js`** raw count |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert the **`app.js`** storage-helper block and the touched call sites + doc edits.

---

## Change log — storage wave 8 (`app.js` + satellites, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/app.js` | **`flux_chrome_extension_id`** global key; **`window.fluxLoadLegacy01`**, **`fluxSaveLegacy01`**, **`fluxLoadStoredString`**, **`fluxSaveStoredString`**; splash / review / role / pending staff / mood / timer / behavior streak keys; extension ID via canonical string helpers |
| `public/js/flux-ai-mega.js` | Bias JSON, break hint ts, explain level → **`load`/`save`** (+ fallbacks) |
| `public/js/flux-personalization.js` | All prior **`localStorage`** reads → **`load`/`save`** |
| `public/js/flux-intelligence.js` | Completion streak → **`save`** |
| `public/js/flux-enhancements-v100.js` | Streak intel → **`load`/`fluxLoadStoredString`** |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 8 table; counts |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert the six files above + doc edits.

---

## Change log — storage wave 9 (theme / profile / accent, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/app.js` | **`flux_profile_pic`** in **`FLUX_IMPERSONATION_GLOBAL_KEYS`**; profile object via **`save('profile')`**; theme/accent/display name/profile pic via **`fluxLoadStoredString`/`fluxSaveStoredString`**; **`loadTheme`** first-run probe uses **`fluxNamespacedKey`** |
| `public/js/splash.js` | Accent hex prefers **`fluxLoadStoredString`** after **`app.js`** |
| `public/js/flux-visual.js` | **`updateNavSquiggle`** accent from **`fluxLoadStoredString`** |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 9 + counts |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert the five files above + doc edits.

---

## Change log — storage wave 10 (owner-suite + compaction, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/owner-suite.js` | **`load`** for streak snapshot keys; backup restore **`save('profile')`**; local nuke stash uses **`fluxNamespacedKey`** |
| `public/js/app.js` | **`save('flux_data_version')`** after migration; storage compaction: **`flux_notes`** via **`load`/`save`**; AI chat key scan uses **`includes('flux_ai_chats')`** |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 10 + counts |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert the three files above + doc edits.

---

## Change log — storage wave 11 (impersonation + account switch + migration keep-list, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/app.js` | **`checkDataVersion` `shouldKeepKey`**: keep **`sb-*`**, keys containing **`supabase`**, and **`imp:`** preview prefixes; **`flux_last_user_*`** on **`FLUX_IMPERSONATION_GLOBAL_KEYS`** + **`fluxLoadStoredString`/`fluxSaveStoredString`**; **`FluxImpersonate`** + **`FluxRole.setMode`** persist impersonation JSON via **`save`/`load`**; account-switch survivors via **`fluxNamespacedKey`** |
| `public/js/flux-release-gate.js` | **`cachedEmail`**: **`fluxLoadStoredString`** when present (JSON + legacy plain fallback) |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 11 + revised counts |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert the three files above + doc edits.

---

## Change log — storage wave 12 (`app.js` clear-cache + sign-out stash, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/app.js` | **`clearCache`**: prefs via **`fluxNamespacedKey`**, preserve **`sb-*`** and keys containing **`supabase`**, **`localStorage.clear`** + restore; keep **`flux_data_version`** / **`flux_splash_shown`**; **`handleSignedOut`**: stash **`keysToKeep`** via **`fluxNamespacedKey`**, include **`flux_last_user_*`** |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 12 + **`flux-ai-orchestrator.js` 0** |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert **`app.js`** + doc edits from this wave.

---

## Change log — storage wave 13 (`flux-toolbox.js` fallbacks + study-tool read, 2026-05-17)

| File | Change |
|------|--------|
| `public/js/flux-toolbox.js` | **`plannerLoad`/`plannerSave`** fallbacks namespaced via **`fluxNamespacedKey`**; **`lsStudyTool`** → **`fluxLoadStoredString`** when available |
| `docs/STORAGE_RAW_INVENTORY.md` | Wave 13 + **`flux-toolbox.js`** count **~2** |
| `docs/stabilization-checkpoint.md` | Step 8 + this log |

**Rollback:** revert **`flux-toolbox.js`** + doc edits from this wave.
