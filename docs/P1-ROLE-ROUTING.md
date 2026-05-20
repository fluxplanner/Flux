# P1-ROLE-ROUTING

**Step ID:** `P1-ROLE-ROUTING`  
**Module:** `public/js/flux-role-routing.js`

## What shipped

| Area | Change |
|------|--------|
| Access matrix | Central `FluxRoleRouting.check(panelId)` used by `assertRoleAccess` |
| Nav remap | `FluxRoleRouting.remapNavTarget(id)` — staff vs admin dashboards, work vs personal |
| Nav UI | `data-admin-nav` only for `role === 'admin'` (not all `isStaff()`) |
| Bug fix | `applyModeToNav`: Google personal tab used undefined `isPersonal` → `!isWork` |
| Admin dashboard | Only `admin` role in work mode (staff uses `staffWorkboard`) |
| Staff personal | Panels only in **personal** mode (or pending-staff onboarding) |
| School feed | Students (+ pending staff personal) only |
| Canvas | Educators in work: staff Google hub OK; teachers/counselors redirected to role home |

## Work vs personal

| Mode | Student | Teacher | Counselor | Staff | Admin |
|------|---------|---------|-----------|-------|-------|
| Personal | Planner chrome | Planner + staff personal tabs | Same | Same | Same |
| Work | — | Teacher dashboards | Counselor dashboards | Workboard | School + Ops |

Mode persisted per user: `flux_staff_mode_<userId>`.

## QA (devtools)

```javascript
localStorage.setItem('FLUX_DEBUG_ROLE', '1');
FluxRoleRouting.auditMatrix(); // console.table per panel
```

Then toggle Work/Personal and open each sidebar item — no unexpected `[assertRoleAccess denied]` in console.

Full matrix: `docs/QA_MATRIX.md` §2–§4.

## Rollback

Revert `flux-role-routing.js`, `index.html` script tag, and `app.js` delegate/remap/admin-nav fixes.
