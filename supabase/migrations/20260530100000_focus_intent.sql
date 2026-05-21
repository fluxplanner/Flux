-- P13.4 Focus intent note before deep work / timer.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_focus_intent',
    'Prompt for a focus intent note before deep work and timer sessions',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
