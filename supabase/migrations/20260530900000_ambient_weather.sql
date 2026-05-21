-- P14.5 Ambient dashboard weather + outdoor study hint.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_ambient_weather',
    'Dashboard weather, sunset, and outdoor study window hint (Open-Meteo)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
