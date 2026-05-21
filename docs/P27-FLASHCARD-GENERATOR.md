# P27.1 — Flashcard generator from notes

**Step ID:** `P27-FLASHCARD-GENERATOR`  
**Flag:** `enable_flashcard_generator` (default **off**)  
**Backlog #14**

On-device flashcard generation from note **headings**, **bullet lists**, and **term: definition** lines — with optional AI fallback.

## Parsing rules

| Source | Card |
|--------|------|
| `h1–h4` + following paragraph | What is {heading}? → paragraph |
| Bullets under heading | Term/def or contextual Q&A |
| `Term: definition` lines | Direct pair |
| **Bold** term in sentence | Term → rest of sentence |
| Fallback | Chunk review cards from prose |

## Flow

1. **Notes** → edit note with headings/bullets
2. **🃏 Generate cards** → preview modal → **Study selected**
3. **Try AI instead** falls back to legacy AI generator
4. **Study saved** reopens cards stored on the note
5. **Shuffle deck** while studying

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_flashcard_generator: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — legacy AI-only 🃏 Flashcards button behavior returns.

Migration: `20260532500000_flashcard_generator.sql`
