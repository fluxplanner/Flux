-- P28.1 SRS deck mode — SM-2 spaced repetition for notes tagged #review.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_srs_deck_mode',
    'SRS deck study mode for notes tagged #review (SM-2 intervals from flashcards or parsed headings)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
