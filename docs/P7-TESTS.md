# P7-TESTS

**Step ID:** `P7-TESTS`  
**Flag:** `enable_e2e_harness` (default **off**; harness also runs when `?e2e=1`)

Playwright smoke tests for three core personas without real Supabase credentials: **student semester**, **teacher workflow**, and **counselor path**.

## Architecture

| Piece | Role |
|-------|------|
| `public/js/flux-e2e-harness.js` | Guest bootstrap, role override, mock Supabase for educator panels |
| `e2e/*.spec.ts` | Playwright specs |
| `playwright.config.ts` | Static server (`serve`) on port 4173 |
| `supabase/migrations/20260525460000_e2e_harness.sql` | Feature flag seed |

### Scenarios (`?e2e=1&scenario=…`)

| Scenario | What it validates |
|----------|-----------------|
| `student-semester` | Seeded tasks across the term, calendar tab, task completion |
| `teacher-workflow` | Teacher nav, dashboard greeting / empty classes, create-class modal |
| `counselor-path` | Counselor nav, dashboard sections (no “record not found”) |
| `ia-east-teacher` | IAE pilot flags + teacher staff widget grid |
| `ia-east-counselor` | IAE pilot flags + counselor widget grid |
| `student-dashboard-widgets` | Hide countdown section + Appearance toggles |

## Run locally

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

UI mode: `npm run test:e2e:ui`

## Manual harness

```
http://localhost:4173/?e2e=1&scenario=teacher-workflow
```

## CI

Set `CI=1` so Playwright starts a fresh static server and uses a single worker. Optional: add `E2E_PORT` if 4173 is taken.

## Rollback

Remove or skip `e2e/` runs; disable flag. Harness is inert without `?e2e=1` or `flux_e2e=1` in localStorage.
