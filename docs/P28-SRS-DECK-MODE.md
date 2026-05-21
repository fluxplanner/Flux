# P28.1 — SRS deck mode (#review notes)

**Step ID:** `P28-SRS-DECK-MODE`  
**Flag:** `enable_srs_deck_mode` (default **off**)  
**Backlog #13**

SM-2 spaced-repetition deck built from notes tagged **`#review`**. Cards come from saved flashcards on the note, or from local heading/bullet parsing when the flashcard generator module is loaded.

## Flow

1. **Notes** → open a note → **🔄 #review** toggles the tag
2. Add content (headings/bullets) and **Generate cards** or save existing flashcards
3. **Notes** tab shows SRS banner with due count → **Start review**
4. **#review** filter lists tagged notes with due badges
5. Study modal: tap to reveal → **Again / Hard / Good / Easy** (SM-2 intervals)

## Card sources

| Priority | Source |
|----------|--------|
| 1 | `note.flashcards[]` saved on the note |
| 2 | `FluxFlashcardGenerator.parseNoteToCards()` when generator flag is also on |

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = {
  enable_srs_deck_mode: true,
  enable_flashcard_generator: true, // optional — richer local card parsing
};
await FluxFeatureFlags.load({ force: true });
location.reload();
```

## Rollback

Disable flag — banner, filter, tag button, and palette command hidden; SRS state remains in local/cloud storage but is inactive.

Migration: `20260532600000_srs_deck_mode.sql`
