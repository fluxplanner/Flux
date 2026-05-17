# Flux Planner — Architecture audit **V2**

**Date:** 2026-05-17  
**Supersedes:** Nothing — extends `ARCHITECTURE_AUDIT.md` (Phase 1) with **V2 scope**: all 27 areas, explicit migration plans, links to new artifacts.

**Related:** `docs/stabilization-checkpoint.md`, `docs/RLS_AUDIT.md`, `docs/STORAGE_RAW_INVENTORY.md`, `public/js/core/debug.js`

---

## Executive principle

**Extend canonical owners.** Do not add parallel routers, buses, storage layers, or role systems. Instrument → contain → extract.

---

## Area 1 — Routing / panel visibility

| | |
|--|--|
| **Canonical owner** | `nav(id, btn, navOpt)` in `public/js/app.js` |
| **Duplicate / secondary** | `applyRoleUI`, `updateModeSwitchUI`, `FluxImpersonate._refresh`, `flux-staff-tabs.js` internal `.active`, CSS `.panel.active`, `body.flux-canvas-ai-split` overrides |
| **Risks** | Multiple `.panel.active`; stale educator DOM; `logicalId` ≠ `id` desync in sidebar |
| **Conflicting paths** | `document.querySelectorAll('.panel')` strip vs panels outside `.main-content` |
| **Migration plan** | (1) `FluxDebug` panel traces + dup-active warnings — **in progress** (2) grep non-`nav` `.panel` mutations → list exceptions (3) optional `assertPanelActive()` dev-only assert |

---

## Area 2 — Role gating

| | |
|--|--|
| **Canonical** | `FluxRole` (`load`, `setMode`, predicates) + `applyRoleUI()` + **`assertRoleAccess(panelId)`** in `app.js` (called from `nav()` after remaps) |
| **Duplicate** | `window._userRole`, `getMyRole()` for owner/dev |
| **Risks** | Client gating ≠ security; synthetic impersonation profile vs DB |
| **Migration** | Optional: call `assertRoleAccess` from heavy `render*` entry points only if leaks reappear — prefer single `nav()` gate |

---

## Area 3 — Educator dashboards

| | |
|--|--|
| **Canonical** | `app.js`: `renderTeacherDashboard`, `renderCounselorDashboard`, `renderAdminDashboard`, `nav` `fns` map |
| **Duplicate** | `flux-educator-platform-extras.js`, `flux-staff-tabs.js`, `flux-staff-platform.js` |
| **Risks** | Cross-role HTML; account-switch clears in `handleSignedIn` must stay aligned |
| **Migration** | Document per-feature owner table (Phase 7); dedupe render **calls**, not files, until parity tests |

---

## Area 4 — Storage + impersonation

| | |
|--|--|
| **Canonical** | `load` / `save` + `fluxNamespacedKey` + `FLUX_IMPERSONATION_GLOBAL_KEYS` / prefix allowlist |
| **Duplicate** | `core/storage.js` blob; raw `localStorage` (~100+ in `app.js` alone) |
| **Risks** | Impersonation leakage; split-brain keys |
| **Migration** | `docs/STORAGE_RAW_INVENTORY.md` → per-file routing; `FluxDebug.traceStorage` |

---

## Area 5 — Supabase sync

| | |
|--|--|
| **Canonical** | `syncToCloud`, `syncFromCloud`, `syncKey` in `app.js` |
| **Risks** | Impersonation must short-circuit sync (verify all new code paths) |
| **Migration** | Sync trace category in `FluxDebug`; document keys synced |

---

## Area 6 — Flux AI state

| | |
|--|--|
| **Canonical** | `app.js`: `aiChats`, `loadAIChatsForUser`, `saveAIChats`, send/render entry points |
| **Duplicate** | `flux-ai-core.js`, `flux-ai-mega.js`, `flux-ai-orchestrator.js`, connections |
| **Risks** | Duplicate stream/tab updates; duplicate `FluxBus` reactions |
| **Migration** | Phase 8: single active stream controller **behind flag**; cancellation tokens |

---

## Area 7 — Event systems

| | |
|--|--|
| **Canonical** | `FluxBus` (`on`/`off`/`emit`); `flux-nav` `CustomEvent` for routing only |
| **Risks** | `task_completed` handled in multiple modules |
| **Migration** | Phase 11: document emitters; dev-only duplicate listener warn (extend `FluxDebug`) |

---

## Area 8 — CSS visibility rules

| | |
|--|--|
| **Canonical** | `public/css/styles.css`: `.main-content > .panel:not(.active)`, mobile overrides, canvas split |
| **Risks** | `!important` wars; AI / canvas bleed |
| **Migration** | Phase 4: z-index tokens; normalize one rule at a time with `FLUX_EXPERIMENTS` |

---

## Area 9 — Mobile nav

| | |
|--|--|
| **Canonical** | `navMob`, `openDrawer` / `closeDrawer`, bottom `.bnav-item`, `moreBtn` fallback in `nav()` |
| **Risks** | Drawer vs `logicalId` highlight |
| **Migration** | NAV traces include `logicalId`; manual QA matrix row |

---

## Area 10 — Canvas integrations

| | |
|--|--|
| **Canonical** | `flux-canvas-panel.js` + `nav('canvas')` + `fluxApplyCanvasSplitLayout` |
| **Risks** | Split layout hides `.panel` globally |
| **Migration** | Canvas-specific QA; no second router |

---

## Area 11 — AI connections

| | |
|--|--|
| **Canonical** | `flux-ai-connections.js` + `app.js` hooks |
| **Risks** | Token keys under `flux_ai_connections_*` global prefixes — intentional; account switch must clear session-scoped tokens |
| **Migration** | Connection registry doc + assert keys on `handleSignedIn` path |

---

## Area 12 — Extension bridge

| | |
|--|--|
| **Canonical** | `flux-extension-bridge.js`; `syncTokenToExtension` in `app.js` |
| **Risks** | CORS / wrong extension ID |
| **Migration** | Phase 13: mark canonical extension folder |

---

## Area 13 — Owner impersonation

| | |
|--|--|
| **Canonical** | `FluxImpersonate` in `app.js` |
| **Risks** | `restore()` no-op if `_orig` missing; stale `FluxRole` |
| **Migration** | IMP traces via `FluxDebug`; never second impersonation store |

---

## Area 14 — Work / personal mode

| | |
|--|--|
| **Canonical** | `FluxRole.setMode`, `flux_staff_mode_<userId>`, `updateModeSwitchUI` |
| **Risks** | Impersonation JSON must mirror mode (already patched in `setMode`) |
| **Migration** | ROLE traces |

---

## Area 15 — Teacher / student messaging

| | |
|--|--|
| **Canonical** | Tables `flux_threads`, `flux_messages`; client helpers (e.g. `fluxEnsureThreadAndSend`) |
| **Risks** | RLS participant-only — OK |
| **Migration** | Document client entry points in one table |

---

## Area 16 — Staff onboarding

| | |
|--|--|
| **Canonical** | `flux-staff-platform.js` + `staff_verification_requests` |
| **Risks** | Initial `user_roles` = `student` until approved; `role_pending` metadata UX |
| **Migration** | Staff flow QA rows in `docs/QA_MATRIX.md` |

---

## Area 17 — Counselor flows

| | |
|--|--|
| **Canonical** | `counselors`, appointments, `ensureCounselorRecord` paths in `app.js` |
| **Risks** | Null `user_id` before self-provision migration |
| **Migration** | Confirm migration applied in prod |

---

## Area 18 — School feed

| | |
|--|--|
| **Canonical** | `school_feed` RLS + `FluxStaffPlatform.renderSchoolFeed` |
| **Risks** | Educator INSERT requires `user_roles` role check |
| **Migration** | RLS doc §6 |

---

## Area 19 — Modal systems

| | |
|--|--|
| **Canonical** | Mixed: inline `createElement` modals, settings tabs, Radix-style feedback modal in `index.html` |
| **Risks** | z-index stacking |
| **Migration** | Phase 4 tokens; modal inventory appendix (future) |

---

## Area 20 — Topbar ownership

| | |
|--|--|
| **Canonical** | `nav()` sets `#topbarTitle`; other modules patch sparingly |
| **Risks** | Race with async panels |
| **Migration** | Document `topbarTitle` writers (grep) |

---

## Area 21 — Loading states

| | |
|--|--|
| **Canonical** | Per-panel (scattered) |
| **Risks** | Inconsistent |
| **Migration** | Optional shared helper **behind flag** |

---

## Area 22 — AI streaming state

| | |
|--|--|
| **Canonical** | Send pipeline in `app.js` + orchestrator |
| **Risks** | Ghost typing indicator |
| **Migration** | Phase 8 controller |

---

## Area 23 — Notification systems

| | |
|--|--|
| **Canonical** | `showToast`, `#toastLive`, panic banner |
| **Migration** | Unify later; no second bus |

---

## Area 24 — Feature flags

| | |
|--|--|
| **Canonical** | `FLUX_FLAGS` in `app.js`; payments toggles |
| **New** | `window.FLUX_EXPERIMENTS` in `public/js/core/debug.js` (mutable object, default false) |
| **Migration** | Risky work behind `FLUX_EXPERIMENTS.*` |

---

## Area 25 — Background sync

| | |
|--|--|
| **Canonical** | `syncKey`, keepalive, debounced sync in `app.js` |
| **Migration** | SYNC traces |

---

## Area 26 — Offline caching

| | |
|--|--|
| **Canonical** | `service-worker.js` (root) + PWA manifest — verify single strategy |
| **Migration** | Phase 12 perf doc |

---

## Area 27 — localStorage migrations

| | |
|--|--|
| **Canonical** | `DATA_VERSION` + `checkDataVersion` in `app.js` |
| **Risks** | `keepExact` set drift |
| **Migration** | Any new global key → add to allowlist + migration notes |

---

## V2 change log

| Date | Change |
|------|--------|
| 2026-05-17 | Initial V2: full 27-area map + links to checkpoint, RLS audit, storage inventory, debug core |
| 2026-05-17 | Phase 6: `assertRoleAccess(panelId)` documented under Area 2; **`nav()`** invokes gate after `logicalId` remap |
