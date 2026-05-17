# Flux Planner — Architecture Audit (Phase 1)

**Generated:** 2026-05-18  
**Repo HEAD:** `54f61d3`  
**Scope:** Read-only inventory of *actual* symbols and files in this workspace. No behavior changes.

This document satisfies **Phase 1** of the stabilization master prompt: map authorities, duplicates, and seams **before** refactors.

---

## Executive summary

| Concern | Canonical authority (today) | Duplicate / secondary pressure |
|--------|------------------------------|----------------------------------|
| Main SPA routing | `nav()` in `public/js/app.js` (~L2367+) | `applyRoleUI`, `updateModeSwitchUI`, `FluxImpersonate._refresh`, CSS (`.panel.active`, split layout) |
| Role + work/personal | `FluxRole` object + `FluxRole.load()` / `setMode()` (~L1329+) | `window._userRole`, `getMyRole()`, inline checks in `nav` / renders |
| Impersonation (owner preview) | `FluxImpersonate` (~L1421+) + `fluxImpersonationPrefix` / `fluxNamespacedKey` (~L41–61) | Direct `localStorage` for `flux_owner_impersonate` in `FluxRole.setMode` (by design) |
| Planner localStorage | `load` / `save` arrow fns (~L60–61) via `fluxNamespacedKey` | Raw `localStorage` across many modules; `public/js/core/storage.js` (ESM blob dual-write — parallel path) |
| Client events | `FluxBus` object (~L12545+) | `document.dispatchEvent('flux-nav')`; module-specific listeners |
| AI | `app.js` (`aiChats`, `loadAIChatsForUser` ~L5571+, orchestration hooks) + `flux-ai-orchestrator.js`, `flux-ai-mega.js`, `flux-ai-core.js` | Multiple subscribers to `FluxBus` for same events |
| Canvas | `public/js/flux-canvas-panel.js` + `nav` canvas branch | `fluxApplyCanvasSplitLayout`, CSS `body.flux-canvas-ai-split` overrides |
| Educator UI extras | `public/js/flux-educator-platform-extras.js` | Overlaps with `app.js` teacher/counselor/admin renderers |
| Staff workspace tabs | `public/js/flux-staff-tabs.js` | `applyRoleUI` + `nav` + own tab `.active` toggles |

**Stabilization principle:** extend these authorities; do **not** add parallel routers, buses, or storage layers without merging into the above.

---

## Navigation

### PRIMARY

- **`nav(id, btn, navOpt)`** — `public/js/app.js` **~L2367–2475+**  
  Responsibilities observed in-file:
  - `tabConfig` visibility gate; `flux_control` owner gate
  - **Educator panel remap** (teacher/counselor/admin vs student) **~L2376–2396**
  - **Logical dashboard id** for sidebar highlight (`logicalId`) **~L2397–2414**
  - **All `.panel`**: remove `active` / `flux-panel-enter`; add `active` on target **~L2415–2422**
  - Sidebar + bottom nav `.active` **~L2424–2434**
  - `CustomEvent('flux-nav', { detail: { panel: id } })` **~L2436**
  - Top bar title (`#topbarTitle`) **~L2444–2448**
  - **Large `fns` map** — per-panel render dispatch **~L2449** (dashboard, calendar, school, … `teacherDashboard`, `adminDashboard`, …)
  - Canvas pending reader flush, split layout, personalization hooks **~L2451–2474**

### SECONDARY (must stay coordinated with `nav`, not forked)

- **`applyRoleUI()`** — `public/js/app.js` **~L1704+** — visibility of student-only vs educator chrome, `[data-role-tab]`, `[data-educator-only]`, `#modeSwitchBar`
- **`updateModeSwitchUI()`** — calls `applyRoleUI`, `applyModeToNav`, may `nav(...)` to role home
- **`updateNavAriaCurrent(tabId)`** — **~L2361+**; used from `nav`
- **`navMob` / `openDrawer` / mobile** — bottom nav explicit handlers (e.g. **~L9304+** for `.bnav-item`)

### RISKS

- **Multiple writers to “active” UI state**: `.panel.active` is central in `nav`, but many features toggle `.active` on **non-panel** controls (toolbox segments, settings tabs, onboarding chips, teacher class tabs). Easy to confuse with “routing.”
- **Educator remap + `logicalId`**: two cooperating transforms; instrumentation should log **both** `id` and `logicalId` after each block.
- **Stale panel HTML**: educator bodies cleared on account switch in `handleSignedIn` path (recent fix); any panel that skips `render*` on `nav` can still show stale DOM.

### SAFE FIRST STABILIZATION SEAM

- **Dev-only logging** at start/end of `nav()` (gate with `localStorage.FLUX_DEBUG_NAV` or `window.FLUX_DEBUG`) logging: `id`, `logicalId`, `FluxRole.current`, `FluxRole.mode`, `!!FluxImpersonate.active()`.

---

## Panel visibility & CSS

### PRIMARY (runtime)

- **`nav()`** — toggles `.panel.active` on elements under `#flux-main` / `.main-content` (structure in `index.html`).

### SECONDARY (stylesheet)

- **`public/css/styles.css`**: `.panel.active` **L305**; `.main-content > .panel:not(.active)` **L313** (mobile variant **L1538**); stricter mobile `.panel.active` **~L1545, L1618**; **canvas+AI split** `body.flux-canvas-ai-split .main-content > .panel{display:none!important}` **L3724** with split chrome **~L3718–3726**
- **AI-specific** `#ai.flux-page.panel.active` **L807**; duplicate `panelReveal` animation on `.panel.active` **L2881** and **L3248**

### RISKS

- **Competing `display` rules**: `display:block`, `!important`, split-layout overrides — “fix leaks” must regression-test **canvas split**, **mobile**, **modals** (often portaled or fullscreen).
- **Duplicate `.panel.active` animation** blocks (**~L2881**, **~L3248**) — possible double intent / specificity wars.

### SAFE FIRST SEAM

- Document **z-index / stacking** for overlays (modal vs topbar vs impersonation banner) before changing any `display` rules.

---

## Role authorities

### PRIMARY

- **`FluxRole`** — `public/js/app.js` **~L1333–1394**  
  - `current`: `'student'|'teacher'|'counselor'|'staff'|'admin'`  
  - `mode`: `'work'|'personal'` (educators)  
  - `profile`: `user_roles` row from Supabase  
  - Helpers: `isTeacher`, `isStaff`, `isEducator`, `isWorkMode`, etc.  
  - **`FluxRole.load()`** — async fetch from `user_roles` **~L1347+**  
  - **`FluxRole.setMode()`** — persists per user; updates impersonation JSON if active **~L1369+**

### SECONDARY / BACK-COMPAT

- **`window._userRole`** — set in `FluxRole.load` **~L1365**
- **`getMyRole()`** — used for owner/dev gating (e.g. `flux_control` in `nav`)

### RISKS

- **Synthetic `profile._impersonated`** vs real `user_roles` row — School panel and others must not treat synthetic rows as DB truth after preview exit (`FluxImpersonate.clear` + `FluxRole.load` path).
- **Scattered role checks** in `nav`, render functions, and Supabase queries — client checks are **UX only**; **RLS** remains authoritative (see Security).

### SAFE FIRST SEAM

- Optional **thin predicates on `FluxRole`** only (e.g. `canAccessEducatorPanel(panelId)`) **implemented as delegates** to existing `isTeacher` / `isStaff` — not a new `RoleGuardV2`.

---

## Impersonation authorities

### PRIMARY

- **`FluxImpersonate`** — `public/js/app.js` **~L1421+** (`read`, `active`, `apply`, `restore`, `set`, `clear`, `_refresh`, `reloadState`)
- **Storage prefixing** — `fluxImpersonationPrefix` **~L41–48**, `fluxNamespacedKey` **~L50–58**, `load`/`save` **~L60–61**
- **Global key denylist** — `FLUX_IMPERSONATION_GLOBAL_KEYS` **~L13–31**, prefix allowlist **~L32–40**

### SECONDARY

- **Early scrub** — non-owner clears `flux_owner_impersonate` **~L70–75** (hardcoded owner email in snippet — **operational risk** if repo is forked)
- **`renderImpersonatePill`** — now teardown-only (no floating pill); banner remains **`renderImpersonationBanner`**

### RISKS

- **`restore()` no-op** if `_orig` missing — leaves `FluxRole` stale; mitigation: **`FluxImpersonate.clear` → `FluxRole.load()`** before `_refresh` (already present in current tree).
- **Sync bypass**: comments **~L1410–1411** — ensure any new persistence paths also respect impersonation.

---

## Storage authorities

### PRIMARY (in-app planner state)

- **`load(k, def)` / `save(k, v)`** — `public/js/app.js` **~L60–61** — **always** through `fluxNamespacedKey(k)` except global keys.

### PARALLEL / SPECIAL

- **`public/js/core/storage.js`** — ESM `loadData` / `saveData` / `flux_data_v1` blob + legacy key mirror — **documented as dual-write** for a subset (tasks/events/notes/mood). **Not** the same entry point as all of `app.js` keys.
- **Raw `localStorage`** — **~103** occurrences under `public/js/app.js` alone (grep count earlier); additional files: `flux-toolbox.js`, `flux-pro.js`, `owner-suite.js`, `flux-release-gate.js`, etc. **This is the main drift vector.**

### RISKS

- New features using **`localStorage` directly** bypass impersonation prefix + migration behavior.
- **`DATA_VERSION` migration** — `checkDataVersion` **~L78+** — must stay consistent with `keepExact` key sets.

### SAFE FIRST SEAM (Phase 5 prep)

- Inventory-only **`STORAGE_AUDIT.md`**: grep `localStorage` per file, classify: *must use `load/save`*, *must stay global*, *bug*.

---

## Event systems

### PRIMARY

- **`FluxBus`** — `public/js/app.js` **~L12545** — `{ on, off, emit }` in-memory pub/sub.

### SUBSCRIBERS (non-exhaustive)

- **`app.js`**: `task_completed`, `momentum_update`, `session_ended` **~L12587–12741+**
- **`flux-ai-mega.js`**: `task_completed` **~L626–627**
- **`flux-ai-orchestrator.js`**: `task_completed`, `session_ended` **~L448–452**

### ALSO USED

- **`flux-nav`** `CustomEvent` from `nav` **~L2436** — separate from `FluxBus`.

### RISKS

- **Double handling** of `task_completed` (mega + orchestrator + dashboard) — order-sensitive; can amplify renders.
- **No built-in dev tracing** — hard to see cascade.

### SAFE FIRST SEAM

- Dev-only wrap `FluxBus.emit` once (count + last payload) — **do not** add `FluxBus2`.

---

## AI ownership (high level)

### WHERE STATE LIVES

- **`app.js`**: `aiChats` **L5569**, `loadAIChatsForUser` / `saveAIChats` **L5571–5572**, `getAIChatKey()`, chat UI init paths (`initAIChats`, `sendAI`, etc. — scattered)
- **`flux-ai-core.js`**: model client surface
- **`flux-ai-mega.js`**: large behaviors + `FluxBus` hooks
- **`flux-ai-orchestrator.js`**: planner context + orchestration; depends on `FluxBus`
- **`flux-ai-connections.js`**: connections UI
- **`flux-intelligence.js`**: supplemental intelligence features

### RISKS

- **Multiple mutation sites** for chat list / active tab / streaming state without a single observable “AI session” object.
- **Orchestrator + mega** both listening to planner events — risk of duplicate side effects.

### SAFE FIRST SEAM

- **Read-only map**: list functions that **mutate** `aiChats` / DOM for AI tab; pick *one* future owner module **only after** instrumentation confirms duplication.

---

## Canvas LMS

### PRIMARY

- **`public/js/flux-canvas-panel.js`** — hub UI, connect flow, add-to-flux dispatch
- **`nav('canvas')` branch** in `app.js` **~L2451+** — pending reader hydration

### CSS CO-OWNERSHIP

- **`styles.css`**: `.cv-body` scroll chain, split layout rules (see grep hits ~L3623–3736)

### RISKS

- **Split layout** forces `display:none!important` on panels — interacts directly with `nav`’s active panel model.

---

## Extension bridge

- **`public/js/flux-extension-bridge.js`** — loaded from `index.html` after `app.js`
- **Chrome extension** under `flux-extension/` (MV3 — background, sidebar, content)

### RISKS

- **CORS / relay** assumptions documented in extension history; any change to `ai-proxy` `_shared/auth` must stay aligned.

---

## Supabase sync

### PRIMARY (conceptual)

- **`syncToCloud` / `syncFromCloud` / `syncKey`** — defined in `app.js` (grep shows heavy usage from tasks, notes, etc.)
- **Impersonation**: explicit short-circuit per comments **~L1410–1411** (verify any new sync paths)

### RISKS

- **Client filters** (e.g. `.eq('teacher_id', currentUser.id)`) are not a substitute for **RLS** — both must stay correct.

---

## Educator platform (surface map)

- **`app.js`**: `renderTeacherDashboard`, `openTeacherClassView`, counselor/admin render hooks in `nav` `fns` map **~L2449**
- **`flux-educator-platform-extras.js`**: `renderAdminDashboard`, modals (announcements, calendar, user manager stubs), **`openTeacherClassesPanel`** routes by role
- **`flux-staff-tabs.js`**: role-specific workspace panels + internal `.active` tab logic

### RISKS

- **Cross-role DOM**: mitigated by `nav` remap + clearing educator panel bodies on account switch; regressions hit **staff** viewing **teacher** HTML most often.

---

## Personalization & motion

- **`flux-personalization.js`** — theme / glass / density (loaded late in `index.html`)
- **`flux-visual.js`**, **`flux-animations.js`**, **`flux-visual-layer.js`**, **`login-motion.js`**, **`splash.js`**

### RISKS

- **Glass** gated by `html[data-flux-glass="on"]` (per earlier commits) — still multiple visual layers can fight `!important`.

---

## Script load order (`index.html`)

**Representative tail (defer order matters):**

1. `app.js`  
2. `flux-educator-platform-extras.js`  
3. `flux-visual.js` → … → `flux-ai-mega.js` → `flux-ai-orchestrator.js` → … → `owner-suite.js` → `flux-pro.js` → `flux-toolbox.js`

**Risk:** circular `window.*` dependencies if load order changes.

---

## Security & data integrity (reminder)

- **RLS + query filters** are authoritative for teacher/student separation.
- **Client `nav` / `FluxRole` gates** prevent accidental UX exposure only.

Audit SQL/migrations separately under `supabase/migrations/` and `PASTE-INTO-SUPABASE.sql`.

---

## Duplicate systems (explicit “do not duplicate” list)

| Already exists | Do **not** add |
|----------------|----------------|
| `nav()` | `FluxRouter2`, `openPanel` parallel to `nav` without delegation |
| `FluxRole` | `RoleGuardV2`, `FluxRole.current` as a function API mismatch |
| `load`/`save` + `fluxNamespacedKey` | second storage wrapper with different prefix rules |
| `FluxBus` | second global event bus |
| `FluxImpersonate` | separate preview storage tree |
| CSS panel rules | wholesale new panel system |

---

## Phase 2 — DEV instrumentation (`window.FluxDebug`)

**All no-op in production** until enabled in the browser console / localStorage.

| Enable | Effect |
|--------|--------|
| `window.FLUX_DEBUG = true` | Master switch (all areas below that check `FluxDebug.on()`). |
| `localStorage.setItem('FLUX_DEBUG','1')` | Same (persists per origin). |
| `localStorage.setItem('FLUX_DEBUG_NAV','1')` | `[FluxNav:start]` / `[FluxNav:end]` + duplicate `.panel.active` warnings. |
| `localStorage.setItem('FLUX_DEBUG_ROLE','1')` | `[FluxRole:load]` / `[FluxRole:setMode]`. |
| `localStorage.setItem('FLUX_DEBUG_IMP','1')` | `[FluxImpersonate:apply]`, `restore`, `set`, `clear` logs. |
| `localStorage.setItem('FLUX_DEBUG_BUS','1')` | `FluxBus.emit` (throttled), duplicate listener warnings on `FluxBus.on`. |
| `localStorage.setItem('FLUX_DEBUG_STORAGE','1')` | `[FluxStorage]` load/save (throttled per key). |
| `localStorage.setItem('FLUX_DEBUG_AI','1')` | `initAIChats`, `loadAIChat`, `sendAI` (throttled). |

**Implementation:** `public/js/app.js` immediately after `fluxImpersonationPrefix` export — `initFluxDebug` IIFE; `load`/`save` delegate to `_fluxLoadRaw` / `_fluxSaveRaw` with optional `traceStorage`; `nav`, `FluxRole`, `FluxImpersonate`, `FluxBus`, AI entry points call `FluxDebug` helpers.

**Disable:** `delete window.FLUX_DEBUG` and remove `FLUX_DEBUG*` keys from localStorage, or set to `0`.

---

## Recommended next steps (matches master prompt Phases 2–4)

1. ~~**Instrumentation only**~~ — **Done (Phase 2):** `FluxDebug` + `nav` / `FluxBus` / role / impersonation / storage / AI hooks (gated).
2. **Grep audit** — all `.panel` manipulations outside `nav`; list exceptions (fullscreen modals, staff-tabs).
3. **`STORAGE_AUDIT.md`** — raw `localStorage` inventory (Phase 5).
4. **Manual matrix** — student / teacher / staff / counselor / owner impersonation / mobile / canvas split (Phase 13).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-18 | Initial audit from workspace scan (HEAD `54f61d3`). |
| 2026-05-18 | Phase 2: `FluxDebug` instrumentation in `app.js` (gated). |
