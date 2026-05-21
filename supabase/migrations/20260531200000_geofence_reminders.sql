-- P15.3 Geofence location reminders.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_geofence_reminders',
    'Campus place geofences — remind when you arrive (library, gym, etc.)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
