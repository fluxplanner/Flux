# P38 — Grade GPS (C4)

**Step ID:** `P38-GRADE-GPS`
**Flag:** `enable_grade_gps` (default **off**)
**District plan:** C4

Per-class "grade GPS" card in the School panel: trajectory sparkline,
user-editable category weights (typed or scanned from a syllabus photo),
and a "Protect my A" plan that proposes study blocks through A4's
confirmation card.

## Architecture

- **Module:** `public/js/flux-grade-gps.js` (`FluxGradeGPS`).
- **Store:** `flux_grade_gps_v1` (registered in `FluxStorageKeys`) —
  `{ byClass: { [classId]: { history:[{date,score}], weights:[{name,weight}], target } } }`.
  localStorage-only; no tables.
- **Trajectory:** one snapshot per class per day from Canvas
  `courseScores` (`current_score`, matched via `class.canvasCourseId`) plus
  manual "Record" entries; last 120 points kept; inline SVG sparkline
  (green rising, gold falling — never a panic red). Missing scores are
  "no grade yet", never an F (`gradeToGpa(null) → null`).
- **Weighted GPA (A1):** card shows the `level` chip and
  `gradeToGpa(score) + fluxCourseWeightBoost(level)` (AP 92.4% → 4.7).
- **Syllabus scan:** existing vision pipeline (`callGemini`) extracts
  `[{name,weight}]`; results land in the **editable** weights rows — the
  user reviews and Save confirms (review/confirm screen).
- **Protect my A:** finds the next graded task for the class, reads the
  matching category weight, spreads 1–3 study blocks (by weight: ≥20% → 3,
  ≥10% → 2) across open days — weekend- and rest-day-aware via `isBreak`
  (which includes C2 closures) — and pipes them through
  `FluxAgentLoop.proposeChanges` (new A4 export) so nothing applies without
  the user's Apply; undo group included for free.

## Migration

`20260710120000_grade_gps_flag.sql` — flag-registry seed only, reversible.

## Telemetry

`grade_gps_plan_proposed` (student, persist, no payload).

## QA

`docs/QA_MATRIX.md` §0ao. Unit: `test/unit/grade-gps.test.mjs` (banding,
missing-grade nulls, sparkline direction/filtering, block pacing). E2E:
`e2e/grade-gps.spec.ts` 4/4 (card render + weighted GPA, manual record,
A4 proposal flow with Apply, flag-off residue).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_grade_gps: true, enable_ai_action_confirm: true };
await FluxFeatureFlags.load({ force: true });
FluxGradeGPS.renderCards();
```

## Rollback

Disable the flag: the card removes itself, snapshots stop, Protect-my-A is
unreachable. The `flux_grade_gps_v1` store remains but is never consulted;
no cloud residue.
