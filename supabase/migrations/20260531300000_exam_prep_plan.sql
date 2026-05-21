-- P16.1 Exam prep plan — daily minutes from countdown.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_exam_prep_plan',
    'Exam countdown with suggested daily study minutes per subject',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
