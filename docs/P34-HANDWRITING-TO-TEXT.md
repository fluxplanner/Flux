# P34.1 — Handwriting-to-text

**Step ID:** `P34-HANDWRITING-TO-TEXT`  
**Flag:** `enable_handwriting_to_text` (default **off**)  
**Backlog #50**

On-device **Tesseract.js** OCR for photos of handwritten notes — editable before insert into the note editor.

## Flow

1. **Notes** → open a note → **✍ Handwriting**
2. Pick a photo (worksheet, notebook, tablet export)
3. Local OCR runs with progress indicator
4. **Edit recognized text** in the modal (line breaks preserved)
5. **Insert into note** as paragraphs

## Privacy

All OCR runs in the browser. Shares Tesseract loader with screenshot snip (`data-flux-tesseract` script tag).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_handwriting_to_text: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — ✍ button hidden; legacy 📷 Import (Gemini) unchanged.

Migration: `20260533200000_handwriting_to_text.sql`
