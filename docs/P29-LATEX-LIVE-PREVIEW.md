# P29.1 — LaTeX live preview

**Step ID:** `P29-LATEX-LIVE-PREVIEW`  
**Flag:** `enable_latex_live_preview` (default **off**)  
**Backlog #49**

Split-pane KaTeX preview while editing math-heavy notes. Delimiters: `$…$`, `$$…$$`, `\(...\)`, `\[...\]`.

## Toolbar (Notes editor)

| Button | Action |
|--------|--------|
| **∑** | Toggle preview split |
| **$x$** | Insert inline template `$E=mc^2$` |
| **$$** | Insert display block |

## Flow

1. **Notes** → open or create a note
2. Type math with `$inline$` or `$$display$$` delimiters
3. Preview updates live in the right pane (KaTeX loaded on first use)
4. Split open/closed preference syncs via cloud slice

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_latex_live_preview: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — editor returns to single-pane; no KaTeX toolbar buttons.

Migration: `20260532700000_latex_live_preview.sql`
