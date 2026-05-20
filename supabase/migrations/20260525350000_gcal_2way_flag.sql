-- P6-GCAL-2WAY: Google Calendar two-way sync + overload-aware scheduling (client-side; flag only).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_gcal_2way', 'Google Calendar two-way sync with overload-aware scheduling hints', false, 'student')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
