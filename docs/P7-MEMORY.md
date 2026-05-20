# P7-MEMORY

**Step ID:** `P7-MEMORY`  
**Flag:** `enable_layered_memory` (default **off**)

Layered AI memory with per-layer reset in Settings → Account.

## Layers

| Layer | Storage | Contents |
|-------|---------|----------|
| **Session** | `localStorage` + RAM | Last ~8 chat turns (truncated) |
| **Working** | `flux_ai_working_memory_v2` (+ orchestrator v1 mirror) | Subject completions, focus hours, recent AI recaps |
| **Long-term** | `flux_user_memory` (`layer = longterm`) | Weakness / habit hints from chat |
| **Preferences** | Local + profile | Grade, program, study style |

## Prompt injection

When enabled, `FluxLayeredMemory.appendToSystem()` adds a structured block to the AI system prompt (after orchestration routing).

## Reset controls

Settings → **Account** → **AI memory** card:

- Reset per layer (session, working, long-term, preferences)
- **Reset all** — local + `flux_reset_user_memory` RPC

## Modules

| File | Role |
|------|------|
| `public/js/flux-layered-memory.js` | Layers, merge, UI, RPC |
| `public/css/flux-layered-memory.css` | Settings panel |
| `supabase/migrations/20260525430000_layered_memory.sql` | `layer` column, reset RPC |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_layered_memory: true };
await FluxFeatureFlags.load({ force: true });
FluxLayeredMemory.install();
```

Open Settings → Account to manage memory.

## Rollback

Disable flag; legacy `FluxAICore.afterExchange` and orchestrator-only memory resume.
