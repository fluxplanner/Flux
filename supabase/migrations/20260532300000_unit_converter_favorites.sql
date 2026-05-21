-- P25.1 Unit converter favorites — pinned quick conversions near quick-add.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_unit_converter_favorites',
    'Pin favorite unit conversions next to quick-add for one-tap results',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
