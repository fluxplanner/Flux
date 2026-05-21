-- P13.1 Global search v2 (fuzzy + keyboard nav + recent queries).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_global_search_v2',
    'Global search fuzzy matching, arrow-key navigation, and recent queries',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
