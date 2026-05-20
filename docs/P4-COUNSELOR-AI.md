# P4-COUNSELOR-AI

**Step ID:** `P4-COUNSELOR-AI`  
**Flag:** `enable_counselor_copilot` (default **off**)

Separate from teacher copilot. Counselor panel uses **caseload aggregates only** — no student names in AI context.

## Behavior

| Feature | Description |
|---------|-------------|
| Side panel | Slide-in copilot with session message history |
| Context | Assigned count, consent counts, engagement bands, outreach signal counts, appointment/message counts |
| Quick chips | Prioritize outreach, check-in template, explain signals |
| FAB | **✦ Copilot** when panel closed (counselor sessions) |
| Audit | Each successful reply logs to `counselor_copilot_audit` (truncated prompt/reply + context JSON) |

System prompt forbids inventing student identities, grades, or clinical diagnoses.

## Entry points (flag on)

- Counselor dashboard → **✦ Copilot** (header)
- FAB (bottom-right) on counselor overview

Context refreshes when `renderCounselorDashboard()` runs (caseload + outreach queue loaded).

## Modules

| File | Role |
|------|------|
| `public/js/flux-counselor-copilot.js` | Panel, chat, context, audit |
| `public/css/flux-counselor-copilot.css` | Drawer + FAB |
| `supabase/migrations/20260525300000_counselor_copilot_audit.sql` | Audit table + flag |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = {
  enable_counselor_caseload: true,
  enable_counselor_risk_queue: true,
  enable_counselor_copilot: true,
};
await FluxFeatureFlags.load({ force: true });
renderCounselorDashboard();
```

## Rollback

Disable flag; panel, FAB, and dashboard button hidden. Audit rows retained.
