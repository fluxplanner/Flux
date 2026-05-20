-- P11.2 IA East — enable syllabus conflict banner for students.

INSERT INTO public.flux_school_feature_flags (school_key, flag_key, enabled) VALUES
  ('International Academy East', 'enable_syllabus_conflict_check', true)
ON CONFLICT (school_key, flag_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
