# P30.1 — Equation OCR → LaTeX

**Step ID:** `P30-EQUATION-OCR-LATEX`  
**Flag:** `enable_equation_ocr_latex` (default **off**)  
**Backlog #15**

Photo of a handwritten or printed equation → Gemini vision → **editable LaTeX** → KaTeX preview → insert as `$$…$$` in the note.

## Flow

1. **Notes** → open a note → **📐 Equation OCR**
2. Pick a photo (worksheet, whiteboard, textbook)
3. AI returns LaTeX — **correct in the textarea** if needed
4. Live KaTeX preview updates as you edit
5. **Insert into note** — pairs with P29 LaTeX live preview when that flag is on

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = {
  enable_equation_ocr_latex: true,
  enable_latex_live_preview: true, // optional — split preview after insert
};
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — 📐 button hidden; legacy 📷 Import unchanged.

Requires `callGemini` (same as note photo import).

Migration: `20260532800000_equation_ocr_latex.sql`
