# P39 — Accommodation Cards (C5)

**Step ID:** `P39-ACCOMMODATION-CARDS`
**Flag:** `enable_accommodation_cards` (default **off**)
**District plan:** C5

Counselor-managed accommodations that surface privacy-safely to teachers,
with a student transparency panel.

## Privacy model (the point of the feature)

1. **Counselors** (same school, `user_roles.school`) create and manage rows;
   `consent_state` is recorded WITH the student (P4-CONSENT framework).
2. **Teachers have no table access.** They call two SECURITY DEFINER RPCs
   scoped to classes they own:
   - `flux_teacher_accommodation_chips` → `[{kind, n}]` aggregates —
     "2 students: extended time" — no names, no notes, private rows counted.
   - `flux_teacher_accommodation_details` → name+kind+note for
     `staff_visible` rows only; **every returned row writes an audit row
     the student can read** (P4-COUNSELOR-AI audit pattern).
3. **Students** see everything about themselves in Settings ("What staff
   can see about me"): each accommodation with its sharing state, plus the
   count of audited staff views. Change requests route to the counselor.

## Architecture

- Module: `public/js/flux-accommodation-cards.js` (`FluxAccommodations`) —
  three flag+role-gated injected cards (teacherDashboard,
  counselorWorkspace/Dashboard, settings) via `flux-nav`; render functions
  take injected data so the e2e client contract runs without live sessions.
- Migration: `20260711090000_accommodation_cards.sql` — tables, RLS, RPCs,
  flag seed; reversible (header). RLS audit: `docs/RLS_AUDIT.md` §14.
- No localStorage keys.

## Telemetry

`accommodation_details_opened` (educator, persist, **no payload** — the
identifying record is the server-side audit row, deliberately not telemetry).

## QA

`docs/QA_MATRIX.md` §0ap. E2E: `e2e/accommodation-cards.spec.ts` 5/5
(chips w/o names, detail modal + audit notice, ask-counselor CTA,
transparency panel labels, flag-off residue).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_accommodation_cards: true };
await FluxFeatureFlags.load({ force: true });
```

## Rollback

Disable the flag: no cards inject, RPCs are never called. Rows and audit
trail are retained (counselor records; drop via the migration rollback if
required). No local residue.
