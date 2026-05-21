# P36.1 — Calc history & plot library

**Step ID:** `P36-CALC-HISTORY`  
**Flag:** `enable_calc_history` (default **off**)  
**Backlog #37–38**

Saved **calculator history tape** (auto-captured from toolbox basic calc) and **graph plot library** with PNG/SVG export. Extends the existing Graph + calc toolbox tool.

## Features

| Action | Result |
|--------|--------|
| **Basic calc =** | Expression + result appended to tape (when flag on) |
| **Save plot** | Captures Y= curves, window, angle mode + thumbnail |
| **History modal** | Tape tab + Plots tab (⌘K: "calc history") |
| **Export tape** | `flux-calc-tape.txt` download |
| **Insert into note** | Markdown list of recent tape entries |
| **PNG / SVG** | Re-render saved plot for export |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_calc_history: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — toolbar bar and auto-capture hidden; saved tape/plots retained.

Migration: `20260533400000_calc_history.sql`
