-- P15.2 Adaptive plan on sick / lazy rest days.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_rest_day_plan',
    'Adaptive dashboard plan on sick/lazy days — defer heavy work, suggest light wins',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
