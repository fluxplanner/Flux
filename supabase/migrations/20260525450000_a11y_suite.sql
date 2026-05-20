-- P7-A11Y: accessibility suite flag (client-side calm / ADHD / motion prefs).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_a11y_suite',
    'Accessibility suite — personal calm mode, ADHD-friendly layout, unified motion prefs',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
