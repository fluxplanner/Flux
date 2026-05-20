-- P3-TEACHER-WELLNESS: aggregate burnout signals on teacher dashboard (opt-in on device).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_teacher_wellness', 'Teacher wellness — aggregate workload burnout signals (opt-in, no student PII)', false, 'teacher')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
