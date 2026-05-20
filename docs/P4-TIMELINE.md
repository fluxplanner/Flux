# P4-TIMELINE

**Step ID:** `P4-TIMELINE`  
**Flag:** `enable_counselor_wellness_timeline` (default **off**)

Requires **`enable_counselor_caseload`** for counselor UI and student consent checkboxes.

## Behavior

Daily **wellness snapshots** (mood, stress, sleep, cognitive load, momentum composite) stored in Supabase when:

- Student has **wellness** consent tier (`student_counselors.consent_tier = 'wellness'`)
- Student saves a mood check-in (or tier is enabled and capture runs)

Counselors with assigned students at wellness tier see **View wellness timeline** on caseload cards:

| Signal | Source |
|--------|--------|
| Mood / stress / sleep | Latest `flux_mood` check-in for that day |
| Load | `calcCognitiveLoad()` score |
| Momentum | `FluxMomentumV2` composite when enabled; else mood+load heuristic |

Timeline modal: 21-day bar chart (momentum) + per-day rows. **No task titles, grades, or notes.**

## Consent tiers

| Tier | Counselor sees |
|------|----------------|
| `none` | Nothing |
| `basic` | Caseload engagement bands (appointments) |
| `wellness` | Basic + wellness timeline |

Student Profile → My counselor: basic checkbox + optional wellness timeline checkbox (requires basic).

## Modules

| File | Role |
|------|------|
| `public/js/flux-counselor-wellness-timeline.js` | Snapshots, modal, consent tier save |
| `public/css/flux-counselor-wellness-timeline.css` | Timeline modal + chart |
| `supabase/migrations/20260525270000_counselor_wellness_timeline.sql` | `student_wellness_snapshots` + RLS + flag |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_counselor_caseload: true,
  enable_counselor_wellness_timeline: true,
};
await FluxFeatureFlags.load({ force: true });
// Student: enable basic + wellness consent, save mood check-in
// Counselor: caseload card → View wellness timeline
```

## Rollback

Disable flag; timeline buttons and wellness consent checkbox hidden. Snapshots remain in DB.

## Follow-ups

- `P4-ALERTS` — done (`docs/P4-ALERTS.md`, outreach queue)
- `P4-CONSENT` — full visibility tier flows
