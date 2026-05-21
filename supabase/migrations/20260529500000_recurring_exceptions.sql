-- P12.5 Recurring task exceptions (skip, shift series, end-after-N).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_recurring_exceptions',
    'Recurring tasks: skip once, shift series, end-after-N; series syncs to cloud',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
