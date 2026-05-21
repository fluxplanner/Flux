-- P14.4 Travel time between consecutive calendar events.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_travel_time',
    'Warn when consecutive timed events leave less than configured travel minutes',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
