# P5-EMERGENCY

**Step ID:** `P5-EMERGENCY`  
**Flag:** `enable_school_emergency_broadcast` (default **off**)

## Behavior

Live **school broadcast** state stored in `flux_school_broadcast` (singleton row per school slug):

| Mode | Effect |
|------|--------|
| **normal** | No broadcast UI |
| **emergency** | Red top banner + `data-school-broadcast=emergency`; also inserts `school_announcements` row |
| **calm** | Blue banner + reduced motion / calmer UI (`data-school-broadcast=calm`) |

Admins/staff use **School broadcast** modal (replaces legacy emergency-only modal when flag on):

- 🚨 Emergency — requires message
- 🧘 Calm mode — optional message (default calm copy if empty)
- ✓ End broadcast — returns to normal

All signed-in users call `FluxSchoolEmergency.refresh()` on sign-in. Banner dismiss is per-device until mode changes.

## Modules

| File | Role |
|------|------|
| `public/js/flux-school-emergency.js` | Fetch/apply state, modal, set broadcast |
| `public/css/flux-school-emergency.css` | Banners + calm mode CSS |
| `supabase/migrations/20260525320000_school_emergency_broadcast.sql` | Table + RLS + flag |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_school_emergency_broadcast: true };
await FluxFeatureFlags.load({ force: true });
// Admin → 🚨 Emergency or Quick Tools → Emergency Alert
```

## Rollback

Disable flag; legacy `openEmergencyAlertModal` / local banner only. Broadcast row remains in DB.
