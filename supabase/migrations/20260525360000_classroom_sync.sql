-- P6-CLASSROOM: Google Classroom sync (client-side API; flag metadata refresh).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_classroom_sync', 'Google Classroom — courses, coursework, and grades import into Flux tasks', false, 'integrations')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
