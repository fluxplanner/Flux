# P12.3 — Voice NL task capture

**Step ID:** `P12-VOICE-CAPTURE`  
**Flag:** `enable_voice_task_capture` (default **off**)  
**Backlog #1**

Mic button on the **quick-add** panel. Speech is transcribed locally via the browser Web Speech API, then parsed with existing `parseNLTask` / `updateQuickAddPreview` (date, subject, priority, type, duration).

## Flow

1. Open quick-add (FAB, ⌘K, or palette).
2. Tap **🎤** — speak e.g. “Math homework due Friday high priority 45 minutes”.
3. Preview chips update live; press **Enter** or **Add** to save.

## Requirements

- HTTPS (or localhost)
- Browser with `SpeechRecognition` / `webkitSpeechRecognition` (Chrome, Edge, Safari iOS 14.5+)

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_voice_task_capture: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — mic hidden; typed quick-add unchanged.

Migration: `20260529300000_voice_task_capture.sql`
