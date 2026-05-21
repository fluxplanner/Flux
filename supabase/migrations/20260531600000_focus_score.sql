-- P18.1 Focus score heuristic — session quality from length vs interruptions.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_focus_score',
    'Focus score heuristic from session length vs tab-switch interruptions',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
