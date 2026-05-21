# P26.1 — Periodic table SRS quizzes

**Step ID:** `P26-PERIODIC-SRS-QUIZ`  
**Flag:** `enable_periodic_srs_quiz` (default **off**)  
**Backlog #40**

Spaced-repetition quizzes for element **symbol**, **name**, and **atomic number** using SM-2–style scheduling.

## Modes

| Mode | Prompt | Answer |
|------|--------|--------|
| Symbol → name | `Fe` | Iron |
| Name → symbol | Iron | Fe |
| Number → symbol | 26 | Fe |

## Flow

1. **Toolbox → Science → Element quiz**
2. Multiple-choice question → reveal → grade (Again / Hard / Good / Easy)
3. Wrong answers go to a **review queue** within the session
4. Progress stored in `flux_periodic_srs_v1` (cloud-synced)

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_periodic_srs_quiz: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — tool chip hidden; SRS progress remains locally.

Migration: `20260532400000_periodic_srs_quiz.sql`
