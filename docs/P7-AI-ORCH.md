# P7-AI-ORCH

**Step ID:** `P7-AI-ORCH`  
**Flag:** `enable_ai_orchestration` (default **off**)

Formal **multi-agent routing** on top of the existing `flux-ai-orchestrator.js` (`FluxOrchestrator`) tool layer.

## Agents

| ID | Audience | Tools | Notes |
|----|----------|-------|-------|
| `student_planner` | Student (personal) | Yes | Default; chains `FluxOrchestrator` tools |
| `student_momentum` | Student | Yes | Energy / burnout / focus keywords |
| `student_college` | Student | No | Admissions / EC advice |
| `educator_instruction` | Teacher, staff (work) | No | Points to Teacher Copilot when enabled |
| `counselor_support` | Counselor (work) | No | Points to Counselor Copilot |
| `admin_ops` | Admin (work) | No | School / district operations tone |

Routing scores keywords + role. When two agents tie, a **specialist consult** block is appended to the system prompt (single model call).

## Modules

| File | Role |
|------|------|
| `public/js/flux-ai-orch-layer.js` | Router, prompt merge, audit |
| `public/js/flux-ai-orchestrator.js` | Unchanged — tools + memory (always loaded) |
| `public/css/flux-ai-orch-layer.css` | Agent badge styles |
| `supabase/migrations/20260525410000_ai_orchestration.sql` | `flux_ai_agent_runs` + RPC |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_ai_orchestration: true };
await FluxFeatureFlags.load({ force: true });
FluxAiOrchestration.install();
// Open Flux AI chat — routing applies on next sendAI()
```

Verify:

```sql
SELECT agent_id, intent, created_at
FROM flux_ai_agent_runs
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;
```

## Telemetry

`ai_agent_routed` (agent ids + intent bucket only) — persisted when `enable_event_bus` is on.

## Rollback

Disable flag; `sendAI` falls back to `FluxOrchestrator.augmentSystemPrompt` only.
