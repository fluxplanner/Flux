-- P12.4 Google Calendar busy-block overlays on Flux calendar.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_gcal_busy_overlay',
    'GCal busy blocks on month grid + conflict banner (requires enable_gcal_2way)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
