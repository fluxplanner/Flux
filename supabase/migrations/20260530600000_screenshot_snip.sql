-- P14.2 Screenshot snip → task (clipboard image + local OCR).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_screenshot_snip',
    'Paste screenshot into quick-add; extract text locally via OCR when possible',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
