# P14.2 — Screenshot snip → task

**Step ID:** `P14-SCREENSHOT-SNIP`  
**Flag:** `enable_screenshot_snip` (default **off**)  
**Backlog #19**

Paste a screenshot into quick-add; Flux extracts text locally with Tesseract.js (loaded on demand) and pre-fills the task field for NL parsing.

## Behavior

| Feature | Detail |
|---------|--------|
| ✂️ button | Quick-add toolbar — reads clipboard image |
| Paste | ⌘V / Ctrl+V image while quick-add is open |
| OCR | Tesseract.js from jsDelivr, client-side only |
| Preview | Thumbnail + word count before add |
| Fallback | File picker when `clipboard.read` unavailable |
| ⌘K | “Screenshot snip → task” |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_screenshot_snip: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

Copy a screenshot → **T** quick-add → paste or tap ✂️ → review text → Add.

## Rollback

Disable flag — quick-add unchanged (no snip button).

Migration: `20260530600000_screenshot_snip.sql`
