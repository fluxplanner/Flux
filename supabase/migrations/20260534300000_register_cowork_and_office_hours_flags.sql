-- Register two flags already shipped client-side but missing from the
-- flux_feature_flags registry (caught by scripts/test-flag-integrity.mjs):
--   enable_cowork        — live shared checklist + presence rooms
--   enable_office_hours  — staff publish weekly drop-in hours; students view

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_cowork', 'Co-work rooms — live shared checklist + presence for any task', true, 'student'),
  ('enable_office_hours', 'Staff office hours — weekly drop-in slots shown to every student on School page', true, 'staff')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
