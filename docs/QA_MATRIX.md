# Flux Planner — QA matrix (stub)

**Status:** Template for Phase 15 manual / automated passes. Expand rows as stabilization proceeds.

## Roles × device × state

Mark: ✓ pass · ✗ fail · — skip

| Scenario | Desktop | Mobile | Notes |
|----------|---------|--------|------|
| Student · default | — | — | |
| Student · onboarding | — | — | |
| Student · Canvas connected | — | — | |
| Student · Google connected | — | — | |
| Teacher · work mode | — | — | |
| Teacher · personal mode | — | — | |
| Counselor · work | — | — | |
| Staff / admin · work | — | — | |
| Owner · impersonation | — | — | No cloud sync |
| Extension active | — | — | |
| AI streaming | — | — | |
| Offline → reconnect | — | — | |

## Panel / nav smoke (after `FLUX_DEBUG_NAV=1` or `flux_debug=on`)

- [ ] Only one `.main-content > .panel.active` after each `nav()`.
- [ ] Bottom nav `aria-current` matches `logicalId` where applicable.
- [ ] Canvas split: no AI panel bleed-through.
- [ ] **`assertRoleAccess`:** with `FLUX_DEBUG_ROLE=1` or master debug, no unexpected denies for valid role/mode (watch console for `assertRoleAccess denied`).

## RLS smoke (Supabase SQL or app UI)

See `docs/RLS_AUDIT.md` checklist section.
