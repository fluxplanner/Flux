# Flux Planner — QA matrix (Phase 15)

**Status:** Living checklist for manual regression passes before releases. Pair with `docs/stabilization-checkpoint.md` (stabilization bundle) and `docs/RLS_AUDIT.md` (Supabase).

**Mark cells:** ✓ pass · ✗ fail · — skip (not applicable)

---

## 1. Debug switches (no console spam unless enabled)

| Goal | Enable |
|------|--------|
| Master (quiet-friendly) | `localStorage.setItem('flux_debug','on')` |
| Master (legacy) | `localStorage.setItem('FLUX_DEBUG','1')` |
| Session-only | `window.FLUX_DEBUG = true` (until reload) |
| Nav start/end logs | `localStorage.setItem('FLUX_DEBUG_NAV','1')` |
| Post-`nav()` panel snapshot (`[FluxPanel]`) | `localStorage.setItem('FLUX_DEBUG_PANEL','1')` **or** master `flux_debug` |
| Role / `assertRoleAccess` | `localStorage.setItem('FLUX_DEBUG_ROLE','1')` |
| Storage namespacing / impersonation | `localStorage.setItem('FLUX_DEBUG_STORAGE','1')` |
| AI pipeline | `localStorage.setItem('FLUX_DEBUG_AI','1')` |
| Perf marks | `localStorage.setItem('FLUX_DEBUG_PERF','1')` |

Implementation: `public/js/core/debug.js` (`window.FluxDebug`).

---

## 2. Roles × surface (smoke)

| Scenario | Desktop | Mobile | Notes |
|----------|---------|--------|------|
| Student · default | — | — | Home/dashboard loads; sidebar + primary tabs switch without blanking. |
| Student · onboarding | — | — | First-run / splash path; complete or skip; lands in app with expected tab. |
| Student · Canvas connected | — | — | Canvas hub loads; course list or empty state; no JS error in console. |
| Student · Google connected | — | — | Docs / Google flows if enabled; token errors handled gracefully. |
| Teacher · work mode | — | — | Educator nav set; staff-only panels gated; `assertRoleAccess` no false deny (see §4). |
| Teacher · personal mode | — | — | Mode switch bar if applicable; student vs work panels consistent. |
| Counselor · work | — | — | Booking / messaging panels per role UI. |
| Staff / admin · work | — | — | Staff tabs + dashboards; no student-only leakage. |
| Owner · impersonation | — | — | Impersonation banner; storage keys namespaced; exit restore (see `docs/STORAGE_RAW_INVENTORY.md`). |
| Extension active | — | — | If browser extension present: no double-inject / CSP issues. |
| AI streaming | — | — | Send message; stream completes or errors with UI feedback; composer stays usable. |
| Offline → reconnect | — | — | Devtools offline; core shell usable or clear message; sync when back online. |

---

## 3. Panel / navigation (after `FLUX_DEBUG_PANEL=1` or `flux_debug=on`)

- [ ] After each `nav(tabId)`, **at most one** `.main-content > .panel.active` (watch for duplicate `.active` if `FLUX_EXPERIMENTS.routingAssertDupPanel` is toggled in devtools).
- [ ] `[FluxPanel]` log shows `panelFound: true` for valid tabs; `routed` matches expected remap for educators.
- [ ] Bottom nav: primary tab has `.bnav-item.active`; secondary routes highlight **More** (`#moreBtn`) when `data-tab` does not match a primary chip.
- [ ] `updateNavAriaCurrent` (or equivalent): `aria-current` on the active control where implemented.
- [ ] **Canvas split** (`body.flux-canvas-ai-split`): `#canvas` + `#ai` visibility matches design; no hidden panel blocking clicks.
- [ ] **Mobile:** `#canvas` / `#toolbox` use `display:flex` when active (see `styles.css` mobile LAYOUT block); other panels `display:block`.
- [ ] **Reduced motion:** `prefers-reduced-motion: reduce` — panel switch animation disabled (`panelReveal` off on `.panel.active`).

---

## 4. `assertRoleAccess` (with `FLUX_DEBUG_ROLE=1`)

- [ ] Open each educator-only panel from sidebar / deep link; expect **no** unexpected `assertRoleAccess denied` for the current role/mode.
- [ ] Intentional deny: student account hitting educator URL → redirect / fallback tab (`dashboard` or role home) without broken layout.

---

## 5. Storage regression (spot)

Authority: `docs/STORAGE_RAW_INVENTORY.md` + `load`/`save` / `FluxStorage`.

- [ ] Toggle a preference (theme, accent, feature flag); reload; value persists (correct namespace when not impersonating).
- [ ] Impersonate (if available): confirm writes do **not** corrupt the owner bubble (keys prefixed per inventory).
- [ ] Optional: `FLUX_DEBUG_STORAGE=1` — console shows throttled `[FluxStorage]` lines on read/write paths.

---

## 6. Supabase / RLS

- [ ] Run SQL checks in `docs/RLS_AUDIT.md` (or linked migrations) against staging.
- [ ] After applying **`supabase/migrations/20260519120000_user_roles_select_tighten.sql`**, re-run §8 checklist in that doc (especially admin user list + join-class preview with `school` set on `user_roles`).
- [ ] Smoke: sign-in, fetch profile, write allowed row, confirm denied row returns policy error (not silent empty).

---

## 7. CSS / layout quick pass

- [ ] **Z-index:** modals, command palette, login screen, mobile “More” sheet stack correctly (no hidden blocking layer).
- [ ] **Panels:** no double `panelIn` / `panelReveal` glitches; tab switch feels like a single animation.
- [ ] **Safe areas:** iOS notch / home indicator — topbar and bottom nav clear content (`flux-mobile-app.css`, `login.css`).

---

## 8. Browsers (minimum bar)

| Browser | Desktop | Mobile / narrow |
|---------|---------|------------------|
| Chrome | — | — |
| Safari | — | — |
| Firefox | — | — (optional if not primary) |

---

## 9. Release gate (short)

1. Clear `localStorage` test profile OR use dedicated test account.  
2. Run §3 with debug on once.  
3. Run §2 row for **your** ship persona (student + educator if shipping both).  
4. §6 if backend changed.  
5. Update this file: date, tester, git SHA in a one-line footer when recording a formal sign-off.

---

**Last expanded:** 2026-05-17 (Phase 15 v1 — post stabilization Phase 4).
