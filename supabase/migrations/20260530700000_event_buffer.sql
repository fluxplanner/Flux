-- P14.3 Buffer time around imported calendar events.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_event_buffer',
    'Padding before/after imported events; warn when tasks land in buffer zones',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
