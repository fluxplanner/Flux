# P44 — Ask-Your-Teacher Handoff (C10)

**Step ID:** `P44-ASK-TEACHER`
**Flag:** `enable_ask_teacher` (default **off**)
**District plan:** C10

On any task linked to a joined teacher class: "Ask my teacher" composes a
context card into the existing staff-messaging pipeline, and teachers get
a triage queue in Lesson Hub.

## Architecture

- **Module:** `public/js/flux-ask-teacher.js` (`FluxAskTeacher`).
- **Card:** task + class + due date + "what I tried" — the student edits
  and previews the EXACT message before sending (consent by construction:
  the handoff is student-initiated and nothing is sent that wasn't shown).
- **Delivery:** the canonical Area-15 pipeline — `fluxEnsureThreadAndSend`
  → `flux_threads`/`flux_messages` (participant-only RLS). No new tables;
  asks are marker-prefixed messages ("📚 Question about: …").
- **Entry point:** an "Ask my teacher" chip in the edit-task modal
  (wraps the global `openEdit`; renders only when the task's class has a
  joined `teacherClassCode`).
- **Rate limit:** 3 asks/day (`flux_ask_teacher_v1`, registered) with calm
  refusal copy ("ask fresh tomorrow, or catch them in class").
- **Teacher triage queue:** Lesson Hub card, marker-filtered messages from
  the last 7 days — student name + first line only, "Open messages" CTA
  into the existing staff messages panel.

## Migration

`20260711140000_ask_teacher_flag.sql` — flag seed only, reversible.

## Telemetry

`ask_teacher_sent` (student, persist, no payload).

## QA

`docs/QA_MATRIX.md` §0au. E2E: `e2e/ask-teacher.spec.ts` 5/5 (verbatim
card compose, rate limit + calm copy, chip gating, queue render,
flag-off inert). Live send path = manual QA (participant-only RLS).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_ask_teacher: true };
await FluxFeatureFlags.load({ force: true });
```

## Rollback

Disable the flag: chip stops rendering, `openForTask` is inert, queue
card disappears. Sent messages remain ordinary messages in the existing
pipeline (they were consented sends); the rate-limit key is inert residue.
