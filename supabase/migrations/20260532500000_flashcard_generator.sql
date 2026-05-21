-- P27.1 Flashcard generator — on-device cards from note headings and bullets.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_flashcard_generator',
    'Generate flashcards from note headings and bullet lists locally (optional AI fallback)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
