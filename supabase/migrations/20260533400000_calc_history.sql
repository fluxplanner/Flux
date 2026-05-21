-- P36.1 Calc history — saved calculator tape + graph plot library.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_calc_history',
    'Calculator history tape and saved graphing plots with PNG/SVG export',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
