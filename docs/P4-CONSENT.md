# P4-CONSENT

**Step ID:** `P4-CONSENT`  
**Flag:** `enable_counselor_consent_flows` (default **off**)

Replaces the legacy dual-checkbox consent UI when enabled (caseload / wellness modules still handle data when their flags are on).

## Visibility tiers

| Tier | Counselor can see |
|------|-------------------|
| **Private** (`none`) | Messages & appointments only |
| **Engagement** (`basic`) | + Caseload band, appointment outreach signals |
| **Wellness summaries** (`wellness`) | + Mood/stress/load/momentum timeline & wellness queue signals |

Never shared: grades, assignment titles, class rosters, raw tasks.

## Student flow

Profile → **My counselor** → tier cards:

- Tap a tier to save (wellness upgrade shows confirm dialog)
- **Stop all sharing** → `none`
- Status line shows last update + current tier

## Counselor flow

- **Visibility & consent** table on overview (all assigned students + tier)
- Caseload cards show tier badge when consented

## Audit

`counselor_consent_audit` — `previous_tier`, `new_tier`, `changed_by`, `created_at`  
RLS: students insert/read own; counselors read for their caseload.

## Modules

| File | Role |
|------|------|
| `public/js/flux-counselor-consent.js` | Tiers UI, save + audit, counselor summary |
| `public/css/flux-counselor-consent.css` | Tier picker + summary table |
| `supabase/migrations/20260525290000_counselor_consent_flows.sql` | Audit table + flag |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_counselor_caseload: true,
  enable_counselor_wellness_timeline: true,
  enable_counselor_consent_flows: true,
};
await FluxFeatureFlags.load({ force: true });
// Student: Profile → pick tier
// Counselor: Overview → Visibility & consent
```

## Rollback

Disable flag; legacy checkboxes return (if caseload flag on). Audit rows retained.
