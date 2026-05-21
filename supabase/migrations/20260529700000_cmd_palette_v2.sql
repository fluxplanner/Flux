-- P12.7 Command palette v2 (fuzzy search + recent commands).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_cmd_palette_v2',
    'Command palette fuzzy search, recent commands, and all tab surfaces',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
