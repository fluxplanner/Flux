-- P15.1 Energy-based scheduling / peak hours hints.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_energy_scheduling',
    'Learn peak energy hours from check-ins; suggest when to schedule heavy tasks',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
