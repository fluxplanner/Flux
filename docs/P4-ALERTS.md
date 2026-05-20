# P4-ALERTS

**Step ID:** `P4-ALERTS`  
**Flag:** `enable_counselor_risk_queue` (default **off**)

Works best with **`enable_counselor_caseload`** (loads consented students). Wellness signals need **`enable_counselor_wellness_timeline`** + student `wellness` consent tier.

## Behavior

**Outreach queue** on the counselor dashboard — sorted engagement signals (not diagnoses):

| Signal | Consent | Source |
|--------|---------|--------|
| Priority / watch outreach | `basic` or `wellness` | Caseload appointment bands |
| Momentum dip | `wellness` | Snapshot drop ≥20 over 3 days |
| Low momentum | `wellness` | Latest momentum ≤25 |
| Low mood pattern | `wellness` | Mood ≤2 on 2+ of last 3 check-ins |
| Elevated stress | `wellness` | Stress ≥8 on 2+ of last 3 check-ins |
| High workload | `wellness` | Latest load_score ≥80 |

Each row: student name, signal label, plain-language detail, **Message**, optional **Timeline**, **Dismiss** (device-local).

## Modules

| File | Role |
|------|------|
| `public/js/flux-counselor-risk-queue.js` | Build queue, render, dismiss, wire actions |
| `public/css/flux-counselor-risk-queue.css` | Queue list styles |
| `supabase/migrations/20260525280000_counselor_risk_queue.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_counselor_caseload: true,
  enable_counselor_wellness_timeline: true,
  enable_counselor_risk_queue: true,
};
await FluxFeatureFlags.load({ force: true });
renderCounselorDashboard();
```

## Rollback

Disable flag; queue section hidden. Dismissals remain in local storage only.

## Follow-ups

- `P4-CONSENT` — full visibility tier flows
- `P4-COUNSELOR-AI` — summarized queue context for copilot
