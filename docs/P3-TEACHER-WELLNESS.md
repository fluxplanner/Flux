# P3-TEACHER-WELLNESS

**Step ID:** `P3-TEACHER-WELLNESS`  
**Flag:** `enable_teacher_wellness` (default **off**)

## Behavior

Optional **Wellness pulse** card on the teacher dashboard:

| Aspect | Detail |
|--------|--------|
| Opt-in | Device-local `flux_teacher_wellness_opt_in_v1` — off until teacher enables |
| Data | **Aggregates only** — review queue, due soon, join/recovery queues, messages, class load |
| No PII | No student names, grades, or per-student metrics |
| Score | 0–100 workload index (not medical) |
| Tiers | Balanced / Moderate / Elevated load |

Teachers can turn off wellness from the card footer.

## Modules

| File | Role |
|------|------|
| `public/js/flux-teacher-wellness.js` | Score heuristic + dashboard HTML |
| `public/css/flux-teacher-wellness.css` | Opt-in + card styles |
| `supabase/migrations/20260525250000_enable_teacher_wellness_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_teacher_wellness: true };
await FluxFeatureFlags.load({ force: true });
renderTeacherDashboard();
// Click "Enable wellness insights" on dashboard
```

## Rollback

Disable flag; opt-in UI and wellness card hidden.
