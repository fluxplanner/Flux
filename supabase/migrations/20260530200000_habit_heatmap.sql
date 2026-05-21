-- P13.5 Habit chain heatmaps.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_habit_heatmap',
    'Habit chain heatmaps with daily check-offs on Focus Timer',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
