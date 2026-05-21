-- P26.1 Periodic table SRS quizzes — spaced repetition for element facts.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_periodic_srs_quiz',
    'Spaced-repetition element quizzes (symbol, name, atomic number) in Toolbox',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
