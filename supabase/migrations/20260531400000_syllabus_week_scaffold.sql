-- P16.2 Syllabus week auto-scaffold — detect week numbers and placeholder tasks.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_syllabus_week_scaffold',
    'Detect syllabus week numbers in tasks and scaffold placeholder weekly tasks',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
