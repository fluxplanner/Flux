-- P12.6 Subject theme packs (colors + icons, JSON export).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_subject_theme_packs',
    'Per-subject color/icon theme packs with JSON import and export',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
