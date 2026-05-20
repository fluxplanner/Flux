-- P9.1 Student dashboard widget picker — show/hide + reorder sections.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_dashboard_widget_picker', 'Dashboard section visibility toggles + layout order (Settings → Appearance)', true, 'student')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
