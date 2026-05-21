-- P33.1 Mind map ↔ tasks — radial map nodes linked to planner tasks.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_mind_map_tasks',
    'Radial mind map on dashboard with nodes linked to tasks (create, link, jump to task)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
