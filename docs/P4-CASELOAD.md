# P4-CASELOAD

**Step ID:** `P4-CASELOAD`  
**Flag:** `enable_counselor_caseload` (default **off**)

## Behavior

**Caseload health** section on the counselor dashboard — only for students who opted in:

| Aspect | Detail |
|--------|--------|
| Consent | `student_counselors.insights_consent` + `consent_tier` (`none` / `basic`) |
| Student UI | Profile → My counselor → checkbox to share basic engagement signals |
| Counselor view | Assigned / consented / priority / watch / stable counts + student cards |
| Data shown | Display name + engagement band from **appointment patterns** only |
| Not shown | Grades, tasks, mood, or students without consent (count only) |
| Bands | `stable`, `watch`, `priority` — non-diagnostic outreach hints |

Card click opens the message thread with that student.

## Modules

| File | Role |
|------|------|
| `public/js/flux-counselor-caseload.js` | Load, score, render, consent save |
| `public/css/flux-counselor-caseload.css` | Caseload + consent styles |
| `supabase/migrations/20260525260000_counselor_caseload_consent.sql` | Consent columns + flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_counselor_caseload: true };
await FluxFeatureFlags.load({ force: true });
// Student: Profile → enable insights sharing
// Counselor: Overview → Caseload health
renderCounselorDashboard();
```

## Rollback

Disable flag; caseload section and student consent UI hidden. Consent columns remain in DB (no PII beyond opt-in state).

## Follow-ups

- `P4-TIMELINE` — done (`docs/P4-TIMELINE.md`, tier `wellness`)
- `P4-CONSENT` — full visibility tier flows
