-- P14.1 Mood + completion velocity + privacy toggle.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_mood_velocity',
    'Mood/energy quick-log with completion velocity chart and privacy toggle',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
