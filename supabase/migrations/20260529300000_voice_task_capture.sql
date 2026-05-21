-- P12.3 Voice NL task capture (quick-add mic).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_voice_task_capture',
    'Voice input on quick-add: Web Speech → NL parse (date, subject, duration)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
