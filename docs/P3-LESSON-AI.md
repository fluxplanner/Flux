# P3-LESSON-AI

**Step ID:** `P3-LESSON-AI`  
**Flag:** `enable_teacher_ai` (default **off**, seeded in `20260524120000_feature_flags_foundation.sql`)

## Behavior

AI **lesson plan generator** for teachers (separate from future P3-TEACHER-COPILOT):

| Feature | Description |
|---------|-------------|
| Modal form | Topic, duration, grade, class, subject, standards, notes |
| AI output | Markdown sections: objectives, hook, instruction, practice, exit ticket, materials |
| Copy | Clipboard copy of raw markdown |
| Drafts | Last plans saved locally (`flux_teacher_lesson_drafts_v1`, device-only) |
| Disclaimer | Draft for teacher review — not auto-posted to students |

## Entry points (flag on)

- Teacher dashboard → **✨ Lesson AI**
- Class drill-down → **✨ Lesson plan**
- Start Class overlay → **✨ Lesson plan** (when live class + teacher AI both enabled)

Uses the same `API.ai` / `fluxAiSimple` proxy as student chat (subject to plan daily limits).

## Modules

| File | Role |
|------|------|
| `public/js/flux-teacher-lesson-ai.js` | Modal, generate, drafts |
| `public/css/flux-teacher-lesson-ai.css` | Form + result styles |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_teacher_ai: true };
await FluxFeatureFlags.load({ force: true });
renderTeacherDashboard();
```

## Rollback

Disable flag; no Lesson AI buttons; existing teacher flows unchanged.
