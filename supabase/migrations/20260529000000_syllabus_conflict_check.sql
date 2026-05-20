-- P11.1 Syllabus / schedule conflict checks on dashboard.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_syllabus_conflict_check',
    'Dashboard banner: exam stacks, subject clashes, duplicate due dates, heavy days',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
