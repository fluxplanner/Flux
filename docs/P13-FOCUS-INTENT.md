# P13.4 — Focus intent note

**Step ID:** `P13-FOCUS-INTENT`  
**Flag:** `enable_focus_intent` (default **off**)  
**Backlog #21**

Prompt for a short intent before deep work (⌘D) or task timer start. Intent appears in the session overlay and is saved to session log + cloud history.

## Flow

1. User starts deep work or **Timer** from a task
2. Modal asks: “What will you accomplish this session?”
3. **Skip** (empty), **Cancel**, or **Start focus**
4. Recent intents shown as quick-fill chips
5. On complete: `sessionLog` entry includes `intent`; history in `flux_focus_intents_v1`

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_focus_intent: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

⌘D or task ⏱ → enter intent → complete session → check `flux_session_log` for `intent` field.

## Rollback

Disable flag — deep work and timer start immediately (no modal).

Migration: `20260530100000_focus_intent.sql`
