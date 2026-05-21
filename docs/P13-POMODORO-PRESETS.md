# P13.6 — Pomodoro presets per subject

**Step ID:** `P13-POMODORO-PRESETS`  
**Flag:** `enable_pomodoro_subject_presets` (default **off**)  
**Backlog #20**

Save work + short-break minutes per class subject on the Focus Timer tab.

## Behavior

| Action | Result |
|--------|--------|
| Select subject | Applies saved work/short minutes if preset exists |
| **Save preset** | Stores current Work/Short inputs for selected subject |
| Subject chips | Quick-apply saved presets |
| Task ⏱ | Uses subject preset, else task estimate for work minutes |
| Cloud | `pomodoroPresets.bySubject` in sync payload |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_pomodoro_subject_presets: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Focus Timer → pick subject → set 45/5 → Save preset → switch subjects → chip restores lengths.

## Rollback

Disable flag — generic 25/5 presets only; saved data kept locally.

Migration: `20260530300000_pomodoro_subject_presets.sql`
