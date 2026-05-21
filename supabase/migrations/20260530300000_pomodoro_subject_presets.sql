-- P13.6 Pomodoro presets per subject.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_pomodoro_subject_presets',
    'Save and sync Pomodoro work/break minutes per class subject',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
