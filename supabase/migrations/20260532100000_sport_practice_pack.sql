-- P23.1 Sport practice pack — drills, hydration, recovery task templates.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_sport_practice_pack',
    'Sport practice planner packs: drills, hydration, recovery + weekly practice schedule',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
