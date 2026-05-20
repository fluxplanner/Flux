# P3-TEACHER-COPILOT

**Step ID:** `P3-TEACHER-COPILOT`  
**Flag:** `enable_teacher_copilot` (default **off**)

Separate from `enable_teacher_ai` (lesson generator). Copilot is a persistent side panel with chat.

## Behavior

| Feature | Description |
|---------|-------------|
| Side panel | Slide-in copilot with message history (session-only) |
| Class scope | Dropdown of teacher’s classes; context reloads on change |
| Context | **Aggregates only** — enrollment, assignment counts, due soon, review backlog, assignment titles (no student names) |
| Quick chips | Today’s focus, draft announcement, warm-up idea |
| FAB | Floating **✦ Copilot** button when panel closed |

System prompt instructs the model not to invent student identities or grades.

## Entry points (flag on)

- Teacher dashboard → **✦ Copilot**
- Class drill-down → **✦ Copilot** (pre-scoped to that class)
- Start Class overlay → **✦ Copilot** (when live class + copilot flags on)
- FAB (bottom-right) on teacher sessions

## Modules

| File | Role |
|------|------|
| `public/js/flux-teacher-copilot.js` | Panel, chat, class context loader |
| `public/css/flux-teacher-copilot.css` | Drawer + FAB styles |
| `supabase/migrations/20260525230000_enable_teacher_copilot_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_teacher_copilot: true };
await FluxFeatureFlags.load({ force: true });
renderTeacherDashboard();
```

## Rollback

Disable flag; panel, FAB, and buttons hidden; no AI calls from copilot.
